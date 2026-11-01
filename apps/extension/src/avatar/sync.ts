import type { AvatarPlayer } from "../contracts";

export type MediaLike = Pick<
  HTMLVideoElement,
  "currentTime" | "playbackRate" | "paused" | "addEventListener" | "removeEventListener"
>;

export interface VideoSyncOptions {
  video: MediaLike;
  player: Pick<AvatarPlayer, "tick" | "play" | "pause" | "setSpeed">;
  /** Read every frame, so popup changes apply immediately. */
  getOffset: () => number;
  /** True while an ad plays: the <video> then shows ad time, which must not move the avatar. */
  isSuspended: () => boolean;
  /** Called with the time sent to the player, after each tick. */
  onTick?: (timeSec: number) => void;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface VideoSync {
  /** Re-applies play state and time, e.g. when an ad ends. */
  refresh(): void;
  destroy(): void;
}

/** Keeps the avatar on the video's clock: a rAF loop calls `player.tick`, and media events map to play/pause/speed. */
export function createVideoSync({
  video,
  player,
  getOffset,
  isSuspended,
  onTick,
  requestFrame = (cb) => window.requestAnimationFrame(cb),
  cancelFrame = (handle) => window.cancelAnimationFrame(handle),
}: VideoSyncOptions): VideoSync {
  const listeners = new AbortController();
  let frame = 0;

  const tick = () => {
    if (isSuspended()) return;
    const t = Math.max(0, video.currentTime + getOffset());
    player.tick(t);
    onTick?.(t);
  };

  const applyPlayState = () => {
    player.setSpeed(video.playbackRate);
    if (video.paused || isSuspended()) player.pause();
    else player.play();
  };

  const loop = () => {
    if (listeners.signal.aborted) return;
    tick();
    frame = requestFrame(loop);
  };

  const on = (type: string, handler: () => void) =>
    video.addEventListener(type, handler, { signal: listeners.signal });
  on("play", () => {
    if (!isSuspended()) player.play();
  });
  on("pause", () => player.pause());
  on("seeking", tick);
  on("seeked", tick);
  on("ratechange", () => player.setSpeed(video.playbackRate));

  applyPlayState();
  frame = requestFrame(loop);

  return {
    refresh() {
      applyPlayState();
      tick();
    },
    destroy() {
      listeners.abort();
      cancelFrame(frame);
    },
  };
}
