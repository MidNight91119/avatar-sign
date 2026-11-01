/**
 * HTTP API (PLAN §4.3). Built from injected services so tests need no network or keys.
 */
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  DiscoverResultSchema,
  HealthSchema,
  SignLangSchema,
  SignReferenceSchema,
  SignTrackSchema,
  type DiscoverResult,
  type SignLang,
  type SignReference,
} from "@signstream/shared";
import { cacheKeys, type Cache } from "./cache";
import { normalizeCaptions, parseVtt, toVtt } from "./captions";
import type { Env } from "./env";
import type { JobManager } from "./jobs";
import { createRateLimiter, type RateLimiter } from "./rate-limit";

export interface AppServices {
  env: Env;
  cache: Cache;
  jobs: JobManager;
  dictionary(lang: SignLang): string[];
  /** Undefined when EXA_API_KEY is missing. */
  discover?: (q: string) => Promise<DiscoverResult[]>;
  signReference?: (word: string) => Promise<SignReference[]>;
  limits?: { newVideos?: RateLimiter; discover?: RateLimiter };
  log?: (line: string) => void;
}

const HOUR = 60 * 60 * 1000;
const VideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "videoId must be an 11-character YouTube id");

/** Origins always allowed: YouTube (extension content script), any Chrome extension, localhost. */
export function isAllowedOrigin(origin: string, extra: string[]): boolean {
  if (extra.includes(origin)) return true;
  if (origin === "https://www.youtube.com" || origin === "https://youtube.com" || origin === "https://m.youtube.com") return true;
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
}

const bad = (c: Context, message: string) => c.json({ error: "BAD_REQUEST", message }, 400);

export function createApp(services: AppServices) {
  const { env, cache, jobs } = services;
  const log = services.log ?? console.log;
  const newVideos = services.limits?.newVideos ?? createRateLimiter(env.RATE_LIMIT_NEW_VIDEOS_PER_HOUR, HOUR);
  const discoverLimit = services.limits?.discover ?? createRateLimiter(env.RATE_LIMIT_DISCOVER_PER_HOUR, HOUR);
  const isAdmin = (c: Context) => Boolean(env.ADMIN_SECRET) && c.req.header("x-admin-secret") === env.ADMIN_SECRET;

  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: (origin) => (origin && isAllowedOrigin(origin, env.ALLOWED_ORIGINS) ? origin : null),
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["content-type", "x-admin-secret"],
      maxAge: 600,
    }),
  );

  app.onError((err, c) => {
    log(`error ${c.req.method} ${c.req.path}: ${err.message}`);
    return c.json({ error: "INTERNAL", message: "Something went wrong" }, 500);
  });

  app.get("/api/health", (c) =>
    c.json(HealthSchema.parse({ ok: true, cerebras: Boolean(env.CEREBRAS_API_KEY), exa: Boolean(env.EXA_API_KEY) })),
  );

  app.get("/api/sign-track", (c) => {
    const videoId = VideoIdSchema.safeParse(c.req.query("videoId"));
    if (!videoId.success) return bad(c, videoId.error.issues[0]!.message);
    const lang = SignLangSchema.safeParse(c.req.query("lang") ?? "ASL");
    if (!lang.success) return bad(c, "lang must be ASL or ISL");

    const refresh = c.req.query("refresh") === "1";
    if (refresh && !isAdmin(c)) return c.json({ error: "FORBIDDEN", message: "refresh needs the admin secret" }, 403);

    let found = refresh ? undefined : jobs.lookup(videoId.data, lang.data, { allowStart: false });
    if (!found) {
      if (!refresh && !newVideos.hit(clientIp(c))) {
        return c.json({ error: "RATE_LIMITED", message: "Too many new videos from this address; try again later" }, 429);
      }
      found = jobs.lookup(videoId.data, lang.data, { refresh });
    }
    return c.json(SignTrackSchema.parse(found!.track));
  });

  // Gloss as a subtitle track for learners. Only serves tracks that already exist, so it never spends credits.
  app.get("/api/sign-track/:videoId/vtt", (c) => {
    const videoId = VideoIdSchema.safeParse(c.req.param("videoId"));
    if (!videoId.success) return bad(c, videoId.error.issues[0]!.message);
    const lang = SignLangSchema.safeParse(c.req.query("lang") ?? "ASL");
    if (!lang.success) return bad(c, "lang must be ASL or ISL");
    const track = jobs.lookup(videoId.data, lang.data, { allowStart: false })?.track;
    if (!track || track.status === "error") {
      return c.json({ error: "NOT_FOUND", message: "No sign track for this video yet; request /api/sign-track first" }, 404);
    }
    if (track.status !== "ready") return c.json({ error: "NOT_READY", message: "The sign track is still processing" }, 409);
    return c.body(toVtt(track.segments), 200, {
      "content-type": "text/vtt; charset=utf-8",
      "content-disposition": `inline; filename="${videoId.data}.${lang.data.toLowerCase()}.vtt"`,
    });
  });

  app.post("/api/captions/:videoId", async (c) => {
    if (!isAdmin(c)) return c.json({ error: "FORBIDDEN", message: "Uploading captions needs the admin secret" }, 403);
    const videoId = VideoIdSchema.safeParse(c.req.param("videoId"));
    if (!videoId.success) return bad(c, videoId.error.issues[0]!.message);
    const lang = SignLangSchema.safeParse(c.req.query("lang") ?? "ASL");
    if (!lang.success) return bad(c, "lang must be ASL or ISL");

    let vtt: string;
    if ((c.req.header("content-type") ?? "").includes("multipart/form-data")) {
      const file = (await c.req.parseBody())["file"];
      if (!(file instanceof File)) return bad(c, 'Send the .vtt file in a form field named "file"');
      vtt = await file.text();
    } else vtt = await c.req.text();

    let captions;
    try {
      captions = normalizeCaptions(parseVtt(vtt));
    } catch (e) {
      return bad(c, (e as Error).message);
    }
    if (captions.length === 0) return bad(c, "The file has no captions");

    const track = jobs.startManual(videoId.data, lang.data, {
      videoId: videoId.data,
      title: c.req.query("title") ?? "",
      description: "",
      durationSec: captions.at(-1)!.end,
      captions,
      track: { languageCode: "en", auto: false },
    });
    if (!track) return c.json({ error: "BUSY", message: "This video is already processing; try again shortly" }, 409);
    return c.json(SignTrackSchema.parse(track), 202);
  });

  app.get("/api/signs", (c) => {
    const lang = SignLangSchema.safeParse(c.req.query("lang") ?? "ASL");
    if (!lang.success) return bad(c, "lang must be ASL or ISL");
    return c.json(z.array(z.string()).parse(services.dictionary(lang.data)));
  });

  app.get("/api/discover", async (c) => {
    const q = z.string().trim().min(2).max(100).safeParse(c.req.query("q") ?? "");
    if (!q.success) return bad(c, "q must be 2–100 characters");
    const key = cacheKeys.discover(q.data);
    const cached = cache.get<DiscoverResult[]>(key);
    if (cached) return c.json(cached);
    if (!services.discover) return c.json({ error: "EXA_DISABLED", message: "Search is not configured" }, 503);
    if (!discoverLimit.hit(clientIp(c))) {
      return c.json({ error: "RATE_LIMITED", message: "Too many searches from this address; try again later" }, 429);
    }
    try {
      const results = z.array(DiscoverResultSchema).parse(await services.discover(q.data));
      cache.set(key, results, 60 * 60);
      return c.json(results);
    } catch (e) {
      log(`exa discover failed: ${(e as Error).message}`);
      return c.json({ error: "UPSTREAM_ERROR", message: "Search failed; try again" }, 502);
    }
  });

  app.get("/api/sign-reference", async (c) => {
    const word = z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z' -]{0,39}$/)
      .safeParse(c.req.query("word") ?? "");
    if (!word.success) return bad(c, "word must be 1–40 letters");
    const key = cacheKeys.signReference(word.data);
    const cached = cache.get<SignReference[]>(key);
    if (cached) return c.json(cached);
    if (!services.signReference) return c.json({ error: "EXA_DISABLED", message: "Sign references are not configured" }, 503);
    try {
      const results = z.array(SignReferenceSchema).parse(await services.signReference(word.data));
      cache.set(key, results);
      return c.json(results);
    } catch (e) {
      log(`exa sign-reference failed: ${(e as Error).message}`);
      return c.json({ error: "UPSTREAM_ERROR", message: "Lookup failed; try again" }, 502);
    }
  });

  app.notFound((c) => c.json({ error: "NOT_FOUND", message: `${c.req.method} ${c.req.path}` }, 404));

  return app;
}
