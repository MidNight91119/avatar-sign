import { ApiClientError, createApiClient, SignTrackSchema, type SignLang, type SignTrack } from "@signstream/shared";
import { TRACK_TIMEOUT_MS } from "../config";
import type { TrackSource } from "../messages";

/** A failure the UI can explain; `code` is a key in errors.ts. */
export class SignTrackFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SignTrackFailure";
  }
}

type StorageLike = Pick<chrome.storage.StorageArea, "get" | "set">;

/** Ready tracks, cached for the browser session (chrome.storage.session), keyed by language + video. */
export function createTrackCache(area: StorageLike) {
  const key = (videoId: string, lang: SignLang) => `track:${lang}:${videoId}`;
  return {
    async get(videoId: string, lang: SignLang): Promise<SignTrack | undefined> {
      const parsed = SignTrackSchema.safeParse((await area.get(key(videoId, lang)))[key(videoId, lang)]);
      return parsed.success && parsed.data.status === "ready" ? parsed.data : undefined;
    },
    async set(track: SignTrack): Promise<void> {
      if (track.status === "ready") await area.set({ [key(track.videoId, track.lang)]: track });
    },
  };
}

export type TrackCache = ReturnType<typeof createTrackCache>;

export interface LoadOptions {
  videoId: string;
  lang: SignLang;
  /** Demo mode: the shared client returns mocks/sign-track.sample.json instead of calling the API. */
  mock: boolean;
  apiOrigin: string;
  cache: TrackCache;
  signal: AbortSignal;
  onProgress?: (progress: number) => void;
  /** Cumulative snapshots while processing (the shared client calls this when there are new segments). */
  onPartial?: (track: SignTrack) => void;
  fetch?: typeof fetch;
  pollIntervalMs?: number;
  /** Network failures (the API down, offline) are retried this many times before giving up. */
  networkRetries?: number;
  retryDelayMs?: number;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

/**
 * Cache first, then `createApiClient().getSignTrack` from @signstream/shared, which polls every 2s while the
 * track is processing and validates every response with the shared zod schema. Each call is self-contained:
 * if the worker is suspended mid-poll, the caller reconnects and calls this again, and the API resumes the same job.
 */
export async function loadSignTrack(opts: LoadOptions): Promise<{ track: SignTrack; source: TrackSource }> {
  const { videoId, lang, signal, networkRetries = 2, retryDelayMs = 1000 } = opts;

  if (!opts.mock) {
    const cached = await opts.cache.get(videoId, lang);
    if (cached) return { track: cached, source: "cache" };
  }

  const client = createApiClient({ baseUrl: opts.apiOrigin, mock: opts.mock, fetch: opts.fetch });
  for (let attempt = 0; ; attempt++) {
    try {
      const track = await client.getSignTrack(videoId, lang, {
        signal,
        onProgress: opts.onProgress,
        onPartial: opts.onPartial,
        pollIntervalMs: opts.pollIntervalMs,
        timeoutMs: TRACK_TIMEOUT_MS,
      });
      if (track.status !== "ready") throw new SignTrackFailure(track.error ?? "INTERNAL");
      if (opts.mock) return { track, source: "mock" };
      await opts.cache.set(track);
      return { track, source: "api" };
    } catch (err) {
      if (signal.aborted) throw signal.reason;
      if (err instanceof SignTrackFailure) throw err;
      if (err instanceof ApiClientError) throw new SignTrackFailure(err.code);
      // fetch() rejects with a TypeError when the API can't be reached.
      if (attempt >= networkRetries) throw new SignTrackFailure("NETWORK");
      await wait(retryDelayMs, signal);
    }
  }
}
