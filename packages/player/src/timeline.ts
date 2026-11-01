import type { SignTrack } from "@signstream/shared";
import { ASL, HN, JOYW, L_LOW, LEXM, NEUTRAL, RREST, SIGNS, qFrom, qRot, signOf, slerp } from "./engine/rig";

/** Both hands' parameters: right hand then left, HN each (see engine/rig.ts). */
export type Pose = number[];
type Quat = number[];

interface Key {
  /** Media time (s) the blend into `pose` starts. */
  t: number;
  pose: Pose;
  ease: number;
  blend: number;
  q: [Quat, Quat];
}

interface Span {
  t0: number;
  t1: number;
  gloss: string;
  joy: boolean;
}

export interface Timeline {
  /** Fills `out` (length 2·HN) with the eased target pose at media time `t`. Pure: same t → same pose. */
  poseAt(t: number, out: Pose): Pose;
  /** The track's sign at `t`, if any. */
  glossAt(t: number): string | undefined;
  /** 0–1 smile weight at `t` (friendly signs make the avatar smile). */
  joyAt(t: number): number;
  /** Media time after the last key. */
  end: number;
}

/** A unit the engine can play: a lexicon sign, or letters to fingerspell. */
export type Unit = { sign: string } | { spell: string };

/** Letters with motion (J, Z) use several keys; every other letter is one pose held ~0.28 s (~3.5 letters/s). */
const MOVES: Record<string, [string, number][]> = {
  J: [
    ["J", 0.14],
    ["J2", 0.2],
  ],
  Z: [
    ["Z1", 0.09],
    ["Z2", 0.09],
    ["Z3", 0.09],
    ["Z4", 0.16],
  ],
};
/** Hand arrives a little before the sign's start, so it is formed while the sign is spoken. */
const LEAD = 0.12;
/** Gaps longer than this drop the hands back to rest. */
const REST_GAP = 1.2;

const DIGIT_NAMES: Record<string, string> = {
  "0": "ZERO", "1": "ONE", "2": "TWO", "3": "THREE", "4": "FOUR",
  "5": "FIVE", "6": "SIX", "7": "SEVEN", "8": "EIGHT", "9": "NINE",
};

function spellUnits(text: string): Unit[] {
  return (text.toUpperCase().match(/[A-Z]+|[0-9]/g) ?? []).map(part => {
    const name = DIGIT_NAMES[part];
    if (!name) return { spell: part };
    const sign = signOf(name);
    // Zero has no native pose: explicitly spell ZERO rather than dropping it.
    return sign ? { sign } : { spell: name };
  });
}

/**
 * Gloss → what to play. "HELLO" → sign; "THANK-YOU" → the two-word sign if the lexicon has it, else each part;
 * "FS:BOB" or anything unknown → fingerspelling (never an error). Digits resolve one at a time; unsupported numeric poses use spelled number names.
 */
export function unitsFor(gloss: string): Unit[] {
  const g = gloss.trim().toUpperCase();
  if (g.startsWith("FS:")) return spellUnits(g.slice(3));
  const whole = signOf(g.replace(/-/g, " "));
  if (whole) return [{ sign: whole }];
  const parts = g.split(/[-\s]+/).filter(Boolean);
  if (parts.length > 1) return parts.flatMap(unitsFor);
  return spellUnits(g);
}

interface RawKey {
  pose: Pose;
  ease: number;
  hold: number;
}

function rawKeys(unit: Unit): RawKey[] {
  if ("sign" in unit) {
    const ks = (SIGNS as unknown as Record<string, [Pose | 0, Pose | 0, number][]>)[unit.sign]!;
    return ks.map(([R, L, hold], j) => ({
      pose: [...(R || RREST), ...(L || L_LOW)],
      ease: 0.2,
      hold: hold + (j === ks.length - 1 ? 0.12 : 0),
    }));
  }
  return [...unit.spell].flatMap((ch) => (MOVES[ch] ?? [[ch, 0.28]]).map(([key, hold]) => ({ pose: (ASL as Record<string, Pose>)[key]!, ease: 0.17, hold })));
}

/** How long a gloss takes at the engine's natural pace (used for previews). */
export function naturalDuration(gloss: string): number {
  return unitsFor(gloss)
    .flatMap(rawKeys)
    .reduce((s, k) => s + k.hold, 0);
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const quats = (pose: Pose): [Quat, Quat] => [0, HN].map((o) => qFrom(pose.slice(o + 3, o + 6), pose.slice(o + 6, o + 9))) as [Quat, Quat];

/**
 * Keyframes on absolute media time from a SignTrack. Each sign's keys are fitted inside its own slot
 * [start, start + duration): compressed when the slot is shorter than the natural pace, never stretched
 * (the hand holds the last pose instead). Fingerspelled letters share their sign's slot (PLAN §11.6).
 */
export function buildTimeline(track: Pick<SignTrack, "segments">): Timeline {
  const signs = track.segments.flatMap((s) => s.signs).sort((a, b) => a.start - b.start);
  const keys: Omit<Key, "blend" | "q">[] = [{ t: -1e9, pose: NEUTRAL, ease: 0.22 }];
  const spans: Span[] = [];
  let lastEnd = -Infinity;

  for (const s of signs) {
    const units = unitsFor(s.gloss);
    const raw = units.flatMap(rawKeys);
    if (!raw.length) continue;
    if (s.start - lastEnd > REST_GAP && lastEnd > -Infinity) keys.push({ t: lastEnd + 0.3, pose: NEUTRAL, ease: 0.3 });
    const natural = raw.reduce((a, k) => a + k.hold, 0);
    const f = Math.min(1, s.duration / natural);
    let t = Math.max(s.start - LEAD, keys.at(-1)!.t + 0.04);
    for (const k of raw) {
      keys.push({ t, pose: k.pose, ease: Math.min(k.ease, Math.max(0.06, k.hold * f)) });
      t += k.hold * f;
    }
    spans.push({ t0: s.start, t1: s.start + s.duration, gloss: s.gloss, joy: units.some((u) => "sign" in u && JOYW.has(u.sign)) });
    lastEnd = s.start + s.duration;
  }
  if (lastEnd > -Infinity) keys.push({ t: lastEnd + 0.3, pose: NEUTRAL, ease: 0.3 });

  // Blend length: the key's ease, longer for big wrist turns, never past the next key (engine's build()).
  const full: Key[] = keys.map((k) => ({ ...k, blend: 0, q: quats(k.pose) }));
  full.forEach((e, i) => {
    const p = full[i - 1] ?? e;
    const turn = Math.max(
      ...[0, 1].map((h) => {
        const d = Math.abs(p.q[h]!.reduce((s, x, k) => s + x * e.q[h]![k]!, 0));
        return (2 * Math.acos(Math.min(1, d))) / Math.PI;
      }),
    );
    e.blend = Math.max(0.01, Math.min(e.ease + 0.12 * turn, (full[i + 1]?.t ?? Infinity) - e.t));
  });

  const keyAt = (t: number) => {
    let lo = 0;
    let hi = full.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (full[mid]!.t <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  return {
    end: lastEnd > -Infinity ? lastEnd + 0.3 : 0,
    poseAt(t, out) {
      const k = keyAt(t);
      const e = full[k]!;
      const pe = full[k - 1] ?? e;
      const u = smooth(Math.min(1, Math.max(0, (t - e.t) / e.blend)));
      for (let i = 0; i < 2 * HN; i++) out[i] = pe.pose[i]! + (e.pose[i]! - pe.pose[i]!) * u;
      // Finger direction and palm normal turn together as one rotation, so the hand can't flip mid-blend.
      for (const h of [0, 1]) {
        const q = slerp(pe.q[h]!, e.q[h]!, u);
        const f = qRot(q, [0, 1, 0]);
        const n = qRot(q, [0, 0, 1]);
        const o = h * HN;
        for (let j = 0; j < 3; j++) {
          out[o + 3 + j] = f[j]!;
          out[o + 6 + j] = -n[j]!;
        }
      }
      return out;
    },
    // ponytail: linear scans over spans, fine for a few hundred signs per video; binary search if tracks get long
    glossAt(t) {
      for (const s of spans) if (t >= s.t0 && t < s.t1) return s.gloss;
      return undefined;
    },
    joyAt(t) {
      let joy = 0;
      for (const s of spans) {
        if (!s.joy) continue;
        const w = Math.min(1, Math.max(0, (t - s.t0 + 0.15) / 0.4)) * Math.min(1, Math.max(0, (s.t1 + 0.5 - t) / 0.4));
        joy = Math.max(joy, w);
      }
      return joy;
    },
  };
}

/** Every word the avatar signs with a real sign, A–Z (anything else is fingerspelled). */
export function knownSigns(): string[] {
  return [...new Set([...Object.keys(SIGNS), ...Object.keys(LEXM)])].sort();
}
