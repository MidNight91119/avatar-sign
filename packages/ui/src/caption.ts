import type { SignTrack } from "@signstream/shared";

/** What the panel shows for one moment of the video. */
export interface CaptionState {
  /** The caption before the current one (or the last one, in a gap). */
  prev?: string;
  /** The caption being signed now. */
  text?: string;
  /** The sign active right now, e.g. "HELLO" or "FS:BOB". */
  gloss?: string;
  /** Start time of that sign; changes when a new sign starts, even if the gloss repeats. */
  signStart?: number;
  /** 0–1 through the prepared track. */
  progress: number;
}

/**
 * Caption and sign for media time `t` (seconds). Pure lookup on absolute time, so seeking
 * backwards or forwards gives the same answer as playing up to `t`.
 * ponytail: linear scan per call, fine for UI polling; the player indexes by time (H-I3).
 */
export function captionAt(track: SignTrack | undefined, t: number): CaptionState {
  const segments = track?.segments ?? [];
  const last = segments.at(-1);
  const progress = last && last.end > 0 ? Math.min(1, Math.max(0, t / last.end)) : 0;
  let i = -1;
  for (let k = 0; k < segments.length && segments[k]!.start <= t; k++) i = k;
  if (i < 0) return { progress };
  const seg = segments[i]!;
  if (t >= seg.end) return { prev: seg.text, progress };
  const sign = seg.signs.find((s) => s.start <= t && t < s.start + s.duration);
  return { prev: segments[i - 1]?.text, text: seg.text, gloss: sign?.gloss, signStart: sign?.start, progress };
}

const TRACK_ERRORS: Record<string, string> = {
  NO_CAPTIONS: "This video has no English captions yet, so there's nothing to sign.",
  VIDEO_UNAVAILABLE: "This video is private or unavailable.",
  LIVE_NOT_SUPPORTED: "Live streams aren't supported yet.",
  VIDEO_TOO_LONG: "Videos up to 15 minutes are supported for now.",
};

/** Plain-language message for a SignTrack error code or client error code. */
export function trackErrorMessage(code?: string): string {
  return TRACK_ERRORS[code ?? ""] ?? "Something went wrong preparing the signs. Try again in a minute.";
}

/** Speeds the panel's speed chip cycles through. */
export const SPEEDS = [0.75, 1, 1.25];
export const nextSpeed = (speed: number) => SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;

/**
 * Splits `text` around the word the gloss stands for, so the panel can highlight it:
 * ("Learn about volcanoes.", "FS:VOLCANO") → ["Learn about ", "volcanoes", "."].
 * No match (glosses often differ from the English words) → [text, "", ""].
 */
export function splitAtGloss(text: string, gloss?: string): [string, string, string] {
  // "THANK-YOU" → /\bthank[\s-]+you…/; anything that isn't a word character is dropped, so no regex injection.
  const parts = (gloss ?? "").replace(/^FS:/, "").split("-").map((p) => p.replace(/[^\w']/g, "")).filter(Boolean);
  if (!parts.length) return [text, "", ""];
  const m = new RegExp(`\\b${parts.join("[\\s-]+")}(?:s|es|ed|ing|'s)?\\b`, "i").exec(text);
  return m ? [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)] : [text, "", ""];
}
