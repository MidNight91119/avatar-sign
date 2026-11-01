// Messages between the extension's contexts, validated at runtime (PLAN §11): a port only carries data,
// and every receiver parses it with these schemas before using it.
import { SignLangSchema, SignTrackSchema } from "@signstream/shared";
import { z } from "zod";

/** Port name for content script / side panel ↔ background worker. One port per video; closing it cancels polling. */
export const SIGN_TRACK_PORT = "sign-track";

const VideoIdSchema = z.string().regex(/^[\w-]{11}$/);
/** Ties updates to the request that asked for them, so a late reply for an old video is ignored. */
const RequestIdSchema = z.string().min(1).max(64);

export const SignTrackRequestSchema = z.object({
  type: z.literal("request"),
  requestId: RequestIdSchema,
  videoId: VideoIdSchema,
  lang: SignLangSchema,
});
export type SignTrackRequest = z.infer<typeof SignTrackRequestSchema>;

export const TRACK_SOURCES = ["api", "cache", "mock"] as const;
export type TrackSource = (typeof TRACK_SOURCES)[number];

export const SignTrackUpdateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), requestId: RequestIdSchema, progress: z.number().min(0).max(1) }),
  /** A cumulative snapshot while processing (PLAN §4.3): receivers replace their track with it, never append. */
  z.object({ type: z.literal("partial"), requestId: RequestIdSchema, track: SignTrackSchema }),
  z.object({ type: z.literal("ready"), requestId: RequestIdSchema, track: SignTrackSchema, source: z.enum(TRACK_SOURCES) }),
  z.object({ type: z.literal("error"), requestId: RequestIdSchema, code: z.string().min(1).max(64) }),
]);
export type SignTrackUpdate = z.infer<typeof SignTrackUpdateSchema>;

/** Port name for side panel → content script of the active tab. The port closing means the side panel closed. */
export const SIDEPANEL_PORT = "sidepanel";

export const RouteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("watch"), videoId: VideoIdSchema }),
  z.object({ kind: z.literal("live"), videoId: VideoIdSchema }),
  z.object({ kind: z.literal("shorts") }),
  z.object({ kind: z.literal("other") }),
]);
export type Route = z.infer<typeof RouteSchema>;

export const PageInfoSchema = z.object({ route: RouteSchema, title: z.string().max(500) });
export type PageInfo = z.infer<typeof PageInfoSchema>;

/** The YouTube <video>'s state, sent on every media event and ~4×/s while playing (timeupdate). */
export const VideoSnapshotSchema = z.object({
  event: z.enum(["sync", "play", "pause", "seeked", "ratechange", "waiting", "playing"]),
  currentTime: z.number().nonnegative(),
  paused: z.boolean(),
  /** Playing but waiting for data: the clock is frozen. */
  buffering: z.boolean(),
  playbackRate: z.number().positive().max(16),
  adShowing: z.boolean(),
  /** Date.now() when sent, to correct for message latency. */
  sentAt: z.number(),
});
export type VideoSnapshot = z.infer<typeof VideoSnapshotSchema>;

export const SidePanelUpdateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page"), page: PageInfoSchema }),
  z.object({ type: z.literal("video"), video: VideoSnapshotSchema }),
]);
export type SidePanelUpdate = z.infer<typeof SidePanelUpdateSchema>;
