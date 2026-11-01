import type { AvatarPlayer } from "./player";

export type MediaLike = Pick<
  HTMLVideoElement,
  "currentTime" | "playbackRate" | "paused" | "readyState" | "addEventListener" | "removeEventListener"
>;

type VisibilityLike = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

export interface VideoSyncOptions {
  video: MediaLike;
  player: Pick<AvatarPlayer, "tick" | "play" | "pause" | "setSpeed">;
  /** Read every frame, so popup changes apply immediately. */
  getOffset: () => number;
  /** True while an ad plays (the <video> then shows ad time) or the panel is minimized: no ticks, player paused. */
  isSuspended: () => boolean;
  /** Called with the time sent to the player, after each tick. */
  onTick?: (timeSec: number) => void;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
  /** Re-sample when the tab becomes visible again (rAF doesn't run in hidden tabs). */
  visibility?: VisibilityLike;
}

export interface VideoSync {
  /** Re-applies play state and time, e.g. when an ad ends or the panel is restored. */
  refresh(): void;
  /** YouTube replaced its <video> element: follow the new one. */
  setVideo(video: MediaLike): void;
  destroy(): void;
}

/** HTMLMediaElement.HAVE_FUTURE_DATA: below this, playback can't continue. */
const HAVE_FUTURE_DATA = 3;

/**
 * Keeps the avatar on the video's clock: a rAF loop calls `player.tick(currentTime + offset)` (never scaled by the
 * rate; the player gets the rate separately), and media events map to play/pause/speed. Buffering freezes it.
 */
export function createVideoSync({
  video: initialVideo,
  player,
  getOffset,
  isSuspended,
  onTick,
  requestFrame = (cb) => window.requestAnimationFrame(cb),
  cancelFrame = (handle) => window.cancelAnimationFrame(handle),
  visibility = globalThis.document,
}: VideoSyncOptions): VideoSync {
  const lifetime = new AbortController();
  let videoListeners = new AbortController();
  let video = initialVideo;
  let buffering = false;
  let frame = 0;

  const tick = () => {
    if (isSuspended()) return;
    const t = Math.max(0, video.currentTime + getOffset());
    player.tick(t);
    onTick?.(t);
  };

  const applyPlayState = () => {
    player.setSpeed(video.playbackRate);
    if (video.paused || buffering || isSuspended()) player.pause();
    else player.play();
  };

  const loop = () => {
    if (lifetime.signal.aborted) return;
    tick();
    frame = requestFrame(loop);
  };

  const bind = (target: MediaLike) => {
    videoListeners.abort();
    videoListeners = new AbortController();
    const { signal } = videoListeners;
    const on = (type: string, handler: () => void) => target.addEventListener(type, handler, { signal });
    on("play", applyPlayState);
    on("pause", () => player.pause());
    on("seeking", tick);
    on("seeked", tick);
    on("ratechange", () => player.setSpeed(target.playbackRate));
    // Buffering: freeze the avatar until media plays again.
    on("waiting", () => {
      buffering = true;
      player.pause();
    });
    on("stalled", () => {
      if (target.readyState >= HAVE_FUTURE_DATA) return; // the network stalled but playback continues
      buffering = true;
      player.pause();
    });
    on("playing", () => {
      buffering = false;
      applyPlayState();
    });
  };

  const refresh = () => {
    applyPlayState();
    tick();
  };

  bind(video);
  visibility?.addEventListener(
    "visibilitychange",
    () => {
      if (visibility.visibilityState === "visible") refresh();
    },
    { signal: lifetime.signal },
  );
  applyPlayState();
  frame = requestFrame(loop);

  return {
    refresh,
    setVideo(next) {
      if (next === video) return;
      video = next;
      buffering = false;
      bind(next);
      refresh();
    },
    destroy() {
      lifetime.abort();
      videoListeners.abort();
      cancelFrame(frame);
    },
  };
}
