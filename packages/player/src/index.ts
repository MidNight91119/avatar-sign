// Avatar player (PLAN §4.4): procedural WebGL2 signer from the handAnimation engine, driven by media time.
import type { SignLang, SignTrack } from "@signstream/shared";
import { CAM, FACE, HN, add, bound, buildHand, coef, cross, norm, sub } from "./engine/rig";
import { FS } from "./engine/shader";
import { buildTimeline, naturalDuration, type Pose, type Timeline } from "./timeline";

export { buildTimeline, knownSigns, naturalDuration, unitsFor } from "./timeline";
export type { Pose, Timeline, Unit } from "./timeline";

export interface AvatarPlayer {
  load(track: SignTrack): void;
  /** Host calls this every animation frame with the video's current time (seconds). */
  tick(currentTimeSec: number): void;
  /** Preview speed only: track playback follows `tick` time and is never rescaled (PLAN §11.3). */
  setSpeed(rate: number): void;
  play(): void;
  pause(): void;
  /** Standalone preview (the /signs page). The next `tick` returns to the track. */
  playSign(gloss: string): void;
  destroy(): void;
}

export interface AvatarPlayerOptions {
  lang?: SignLang;
  /** Unused: the avatar is procedural and needs no asset files. Kept for the PLAN §4.4 signature. */
  assetsBaseUrl?: string;
  /** Show the current gloss under the avatar. */
  showGloss?: boolean;
}

const N = HN * 2;
/** A media-time jump bigger than this (or any backward jump) is a seek: snap to the new pose instead of sweeping. */
const SEEK_JUMP = 0.6;
/** Painted avatar in the shader: 0 Suki (deco portrait), 1 Sara (hanfu, light backdrop), 2 Sasha (crimson hijab). */
const AVATAR = 1;

const VS = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;
const UNIFORMS = ["uAv", "uRes", "uTime", "uFace", "uExpr", "uCam", "uCR", "uCU", "uCF", "uSeg", "uBnd", "uHR", "uHP", "uArm", "uTL"] as const;

interface Hand {
  X: number[];
  Y: number[];
  Z: number[];
  TL: number[];
  pos: number[];
  segs: [number[], number[], number, number][];
  arm: [number[], number, number[], number];
  bounds: [number[], number][];
}

const noopPlayer: AvatarPlayer = { load() {}, tick() {}, setSpeed() {}, play() {}, pause() {}, playSign() {}, destroy() {} };

export function createAvatarPlayer(container: HTMLElement, opts: AvatarPlayerOptions = {}): AvatarPlayer {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  container.append(canvas);
  const label = opts.showGloss ? document.createElement("div") : null;
  if (label) {
    label.style.cssText = "position:absolute;left:0;right:0;bottom:8px;text-align:center;font:600 13px/1.4 system-ui,sans-serif;letter-spacing:.08em";
    container.append(label);
  }

  const ctx = canvas.getContext("webgl2", { antialias: false, alpha: false });
  const fail = (msg: string) => {
    canvas.remove();
    const p = document.createElement("p");
    p.textContent = msg;
    p.style.cssText = "margin:auto;padding:24px;text-align:center;font:14px/1.4 system-ui,sans-serif";
    container.append(p);
    return { ...noopPlayer, destroy: () => p.remove() };
  };
  if (!ctx) return fail("This browser can't show the signing avatar (WebGL2 is off or unsupported).");
  const gl = ctx;

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
    return s;
  };
  const prog = gl.createProgram()!;
  try {
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
  } catch (e) {
    console.error(e);
    return fail("The signing avatar couldn't start on this device.");
  }
  gl.useProgram(prog);
  const U = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  // ---- springs (engine's 2nd-order, near-critically damped; fingers trail the wrist slightly via DELAY)
  const Y = new Float32Array(N);
  const V = new Float32Array(N);
  const XP = new Float32Array(N);
  const DELAY = new Float32Array(N);
  const K: { k1: number; k2: number; k3: number }[] = [];
  for (let i = 0; i < N; i++) {
    const j = i % HN;
    let c = coef(2.6, 0.95, 0);
    let d = 0;
    if ((j >= 3 && j < 9) || j >= 30) c = coef(2.4, 0.95, 0);
    if (j >= 9 && j < 25) {
      c = coef(4.2, 1, 0);
      d = 0.022 * Math.floor((j - 9) / 4);
    }
    if (j >= 25 && j < 30) {
      c = coef(4.0, 1, 0);
      d = 0.01;
    }
    K.push(c);
    DELAY[i] = d + (i >= HN ? 0.03 : 0);
  }
  // one target pose per distinct delay, recomputed each substep
  const delays = [...new Set(DELAY)];
  const delayIdx = Array.from(DELAY, (d) => delays.indexOf(d));
  const targets: Pose[] = delays.map(() => new Array<number>(N).fill(0));
  const fillTargets = (tl: Timeline, t: number) => delays.forEach((d, k) => tl.poseAt(t - d, targets[k]!));

  let timeline = buildTimeline({ segments: [] });
  let preview: { tl: Timeline; t: number } | null = null;
  let mediaT = 0;
  let lastTick: number | undefined;
  let prevClock = 0;
  let snap = true;
  let playing = true;
  let life = 1; // idle sway + camera drift; fades out while paused so the hands hold still
  let rate = 1;
  let sim = 0;
  let scale = 0.85;
  let visible = true;
  let destroyed = false;
  let shownGloss: string | undefined;

  const resize = () => {
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => (visible = es.some((e) => e.isIntersecting)));
  io.observe(container);
  resize();

  const segBuf = new Float32Array(240);
  const bndBuf = new Float32Array(48);
  const hrBuf = new Float32Array(18);
  const hpBuf = new Float32Array(6);
  const tlBuf = new Float32Array(6);
  const armBuf = new Float32Array(16);
  let last = performance.now();
  let ema = 16;
  let frames = 0;
  let raf = requestAnimationFrame(frame);

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden || dt <= 0) return;
    // adapt render scale to hold ~60 fps (engine's budget)
    ema = ema * 0.95 + dt * 1000 * 0.05;
    if (++frames % 90 === 0) {
      const s = ema > 24 ? scale * 0.88 : ema < 13 && scale < 1 ? scale * 1.06 : scale;
      if (s !== scale) {
        scale = Math.max(0.35, Math.min(1, s));
        resize();
      }
    }

    if (preview) {
      preview.t += dt * rate;
      if (preview.t > preview.tl.end + 0.4) preview = null;
    }
    const tl = preview ? preview.tl : timeline;
    const clock = preview ? preview.t : mediaT;
    if (snap) {
      fillTargets(tl, clock);
      for (let i = 0; i < N; i++) {
        Y[i] = XP[i] = targets[delayIdx[i]!]![i]!;
        V[i] = 0;
      }
      prevClock = clock;
      snap = false;
    }
    const ns = Math.ceil(dt / (1 / 240));
    for (let k = 0; k < ns; k++) {
      const h = dt / ns;
      sim += h;
      fillTargets(tl, prevClock + ((clock - prevClock) * (k + 1)) / ns);
      for (let i = 0; i < N; i++) {
        const x = targets[delayIdx[i]!]![i]!;
        const xd = (x - XP[i]!) / h;
        XP[i] = x;
        const { k1, k2, k3 } = K[i]!;
        const k2s = Math.max(k2, (h * h) / 2 + (h * k1) / 2, h * k1);
        Y[i]! += h * V[i]!;
        V[i]! += (h * (x + k3 * xd - Y[i]! - k1 * V[i]!)) / k2s;
      }
    }
    prevClock = clock;
    life += ((playing || preview ? 1 : 0) - life) * Math.min(1, dt * 3);

    const P = Array.from(Y);
    for (let hi = 0; hi < 2; hi++) {
      const o = hi * HN;
      P[o]! += life * 0.12 * Math.sin(sim * 1.1);
      P[o + 1]! += life * 0.16 * Math.sin(sim * 0.8 + 1);
      P[o + 2]! += life * 0.1 * Math.sin(sim * 0.6);
    }
    const yaw = CAM.yaw + life * 0.03 * Math.sin(sim * 0.37);
    const pitch = CAM.pitch + life * 0.015 * Math.sin(sim * 0.5);
    const cam = add(CAM.tgt, [CAM.dist * Math.sin(yaw) * Math.cos(pitch), CAM.dist * Math.sin(pitch), CAM.dist * Math.cos(yaw) * Math.cos(pitch)]);
    const F = norm(sub(CAM.tgt, cam));
    const R = norm(cross(F, [0, 1, 0]));
    const Uv = cross(R, F);

    const H = [buildHand(P.slice(0, HN), 1), buildHand(P.slice(HN), -1)].map(bound) as Hand[];
    H.forEach((h, hi) => {
      h.segs.forEach(([a, b, ra, rb], s) => segBuf.set([...a, ra, ...b, rb], (hi * 15 + s) * 8));
      h.bounds.forEach(([c, r], b) => bndBuf.set([...c, r], (hi * 6 + b) * 4));
      hrBuf.set([...h.X, ...h.Y, ...h.Z], hi * 9);
      hpBuf.set(h.pos, hi * 3);
      tlBuf.set(h.TL, hi * 3);
      armBuf.set([...h.arm[0], h.arm[1], ...h.arm[2], h.arm[3]], hi * 8);
    });

    const blink = (sim % 3.7) / 0.13;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, sim);
    gl.uniform1f(U.uAv, AVATAR);
    gl.uniform3fv(U.uFace, FACE);
    gl.uniform3fv(U.uExpr, [tl.joyAt(clock), blink >= 1 ? 1 : Math.abs(blink * 2 - 1), 0]);
    gl.uniform3fv(U.uCam, cam);
    gl.uniform3fv(U.uCR, R);
    gl.uniform3fv(U.uCU, Uv);
    gl.uniform3fv(U.uCF, F);
    gl.uniform4fv(U.uSeg, segBuf);
    gl.uniform4fv(U.uBnd, bndBuf);
    gl.uniformMatrix3fv(U.uHR, false, hrBuf);
    gl.uniform3fv(U.uHP, hpBuf);
    gl.uniform4fv(U.uArm, armBuf);
    gl.uniform3fv(U.uTL, tlBuf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (label) {
      const g = tl.glossAt(clock);
      if (g !== shownGloss) label.textContent = (shownGloss = g) ?? "";
    }
  }

  return {
    load(track) {
      if (destroyed) return;
      // Partial snapshots replace the schedule; media time is kept (PLAN §11.7).
      timeline = buildTimeline(track);
    },
    tick(t) {
      if (destroyed || !Number.isFinite(t)) return;
      if (preview) {
        preview = null;
        snap = true;
      }
      if (lastTick === undefined || t < lastTick - 0.05 || t - lastTick > SEEK_JUMP) snap = true;
      lastTick = mediaT = t;
    },
    setSpeed(r) {
      if (r > 0 && Number.isFinite(r)) rate = r;
    },
    play() {
      playing = true;
    },
    pause() {
      playing = false;
    },
    playSign(gloss) {
      if (destroyed) return;
      const d = Math.max(0.4, naturalDuration(gloss));
      const tl = buildTimeline({ segments: [{ start: 0, end: d + 0.6, text: gloss, signs: [{ gloss, start: 0.2, duration: d }] }] });
      preview = { tl, t: 0 };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
      label?.remove();
    },
  };
}
