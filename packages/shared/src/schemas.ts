import { z } from "zod";

/** Sign languages we support. ASL first (PLAN §2). */
export const SIGN_LANGS = ["ASL", "ISL"] as const;
export const SignLangSchema = z.enum(SIGN_LANGS);
export type SignLang = z.infer<typeof SignLangSchema>;

/** Timed caption cue, as returned by the transcript step. Times are in seconds. */
export const CaptionSchema = z
  .object({
    start: z.number().nonnegative(),
    end: z.number().nonnegative(),
    text: z.string(),
  })
  .refine((c) => c.end >= c.start, { message: "end must be >= start" });
export type Caption = z.infer<typeof CaptionSchema>;

/** One sign in the track. `gloss` is a dictionary key such as "STORE", or "FS:BOB" for fingerspelling. */
export const SignSchema = z.object({
  gloss: z.string().min(1),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  nonManual: z.enum(["question", "negation", "emphasis"]).optional(),
});
export type Sign = z.infer<typeof SignSchema>;

export const SegmentSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
  signs: z.array(SignSchema),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const SIGN_TRACK_ERRORS = [
  "NO_CAPTIONS",
  "VIDEO_UNAVAILABLE",
  "LIVE_NOT_SUPPORTED",
  "VIDEO_TOO_LONG",
  "GLOSS_FAILED",
  "INTERNAL",
] as const;
export const SignTrackErrorSchema = z.enum(SIGN_TRACK_ERRORS);
export type SignTrackError = z.infer<typeof SignTrackErrorSchema>;

/** The sign track for one video (PLAN §4.1). */
export const SignTrackSchema = z.object({
  videoId: z.string().min(1),
  lang: SignLangSchema,
  source: z.enum(["youtube-captions", "manual"]),
  status: z.enum(["processing", "ready", "error"]),
  progress: z.number().min(0).max(1).optional(),
  error: SignTrackErrorSchema.optional(),
  segments: z.array(SegmentSchema),
});
export type SignTrack = z.infer<typeof SignTrackSchema>;

/** Background about a video, found with Exa (PLAN §4.2). */
export const VideoContextSchema = z.object({
  topic: z.string(),
  names: z.array(z.string()),
  terms: z.array(z.object({ term: z.string(), meaning: z.string() })),
});
export type VideoContext = z.infer<typeof VideoContextSchema>;

/** `GET /api/discover?q=` result item (PLAN §4.3). */
export const DiscoverResultSchema = z.object({
  videoId: z.string().min(1),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  thumbnail: z.string().url(),
});
export type DiscoverResult = z.infer<typeof DiscoverResultSchema>;

/** `GET /api/sign-reference?word=` result item (PLAN §4.3). */
export const SignReferenceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
  highlight: z.string().optional(),
});
export type SignReference = z.infer<typeof SignReferenceSchema>;

/** `GET /api/health` response. */
export const HealthSchema = z.object({
  ok: z.boolean(),
  cerebras: z.boolean(),
  exa: z.boolean(),
});
export type Health = z.infer<typeof HealthSchema>;

/** Error body for non-2xx API responses. */
export const ApiErrorSchema = z.object({ error: z.string(), message: z.string().optional() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** JSON Schema for VideoContext, for Exa's `outputSchema` and Cerebras structured outputs. */
export const videoContextJsonSchema = z.toJSONSchema(VideoContextSchema);
