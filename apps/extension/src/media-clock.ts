/** One report from the content script about the YouTube video. */
export interface ClockSample {
  t: number;
  rate: number;
  paused: boolean;
}

/** A report plus when it arrived (performance.now() ms). */
export interface Clock extends ClockSample {
  at: number;
}

/** Reports stop during ads or when the tab is hidden: don't run ahead of the video for longer than this. */
const MAX_AHEAD_S = 1;

/**
 * Media time now, from the last report: the content script reports ~4×/s (timeupdate), the avatar needs a
 * smooth clock every frame. Paused video → the reported time, unchanged.
 */
export function mediaTimeAt(c: Clock, now: number): number {
  if (c.paused) return c.t;
  return c.t + Math.min(MAX_AHEAD_S, Math.max(0, (now - c.at) / 1000)) * c.rate;
}

/** Validates a runtime message from the content script. */
export function isClockMessage(msg: unknown): msg is ClockSample & { type: "signside:time" } {
  const m = msg as Partial<ClockSample> & { type?: string };
  return m?.type === "signside:time" && Number.isFinite(m.t) && Number.isFinite(m.rate) && typeof m.paused === "boolean";
}
