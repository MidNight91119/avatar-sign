// Local mirror of the shared contracts in PLAN §4.1 (SignTrack) and §4.4 (AvatarPlayer).
// packages/shared doesn't export the zod schemas yet, and @signstream/player doesn't export
// createAvatarPlayer yet. Once they do, import these types from there and delete this file.
import { SIGN_LANGS, type SignLang } from "@signstream/shared";

export type { SignLang };

export interface Sign {
  gloss: string; // "STORE", or "FS:BOB" for fingerspelling
  start: number; // seconds in the video
  duration: number; // seconds
  nonManual?: "question" | "negation" | "emphasis";
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  signs: Sign[];
}

export interface SignTrack {
  videoId: string;
  lang: SignLang;
  source: "youtube-captions" | "manual";
  status: "processing" | "ready" | "error";
  progress?: number;
  error?: string;
  segments: Segment[];
}

export interface AvatarPlayer {
  load(track: SignTrack): void;
  tick(currentTimeSec: number): void;
  setSpeed(rate: number): void;
  play(): void;
  pause(): void;
  playSign(gloss: string): void;
  destroy(): void;
}

export interface AvatarPlayerOptions {
  lang?: SignLang;
  assetsBaseUrl?: string;
  showGloss?: boolean;
}

export type CreateAvatarPlayer = (container: HTMLElement, opts?: AvatarPlayerOptions) => AvatarPlayer;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSign = (value: unknown): value is Sign =>
  isObject(value) &&
  typeof value.gloss === "string" &&
  typeof value.start === "number" &&
  typeof value.duration === "number";

const isSegment = (value: unknown): value is Segment =>
  isObject(value) &&
  typeof value.start === "number" &&
  typeof value.end === "number" &&
  typeof value.text === "string" &&
  Array.isArray(value.signs) &&
  value.signs.every(isSign);

/** Structural check for API responses until the shared zod schema exists. */
export function isSignTrack(value: unknown): value is SignTrack {
  return (
    isObject(value) &&
    typeof value.videoId === "string" &&
    SIGN_LANGS.includes(value.lang as SignLang) &&
    (value.status === "processing" || value.status === "ready" || value.status === "error") &&
    Array.isArray(value.segments) &&
    value.segments.every(isSegment)
  );
}
