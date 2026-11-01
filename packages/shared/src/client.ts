import { z } from "zod";
import sampleTrack from "../../../mocks/sign-track.sample.json";
import {
  ApiErrorSchema,
  DiscoverResultSchema,
  HealthSchema,
  SignReferenceSchema,
  SignTrackSchema,
  type DiscoverResult,
  type Health,
  type SignLang,
  type SignReference,
  type SignTrack,
} from "./schemas";

export interface ApiClientOptions {
  /** API origin, for example "http://localhost:8787". Paths like "/api/health" are appended. */
  baseUrl: string;
  /** Return mock data instead of calling the API. Defaults to true when the MOCK env variable is "1". */
  mock?: boolean;
  /** Custom fetch (tests, extension background worker). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

export interface GetSignTrackOptions {
  /** Called with 0–1 while the track is processing. */
  onProgress?: (progress: number) => void;
  /**
   * Called while processing with the segments glossed so far, so the avatar can start before
   * the whole video is done. Only called when there are new segments.
   */
  onPartial?: (track: SignTrack) => void;
  /** Poll interval while processing. Default 2000 ms (PLAN §4.3). */
  pollIntervalMs?: number;
  /** Give up after this long. Default 5 minutes. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Thrown for non-2xx responses, invalid payloads and timeouts. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

const MOCK_SIGNS = [
  ...new Set(
    SignTrackSchema.parse(sampleTrack).segments.flatMap((s) => s.signs.map((x) => x.gloss)).filter((g) => !g.startsWith("FS:")),
  ),
].sort();

function envMock(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.MOCK === "1";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const mock = options.mock ?? envMock();
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));

  async function get<S extends z.ZodType>(path: string, schema: S, signal?: AbortSignal): Promise<z.infer<S>> {
    const res = await doFetch(`${baseUrl}${path}`, { signal, headers: { accept: "application/json" } });
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const err = ApiErrorSchema.safeParse(body);
      throw new ApiClientError(
        err.success ? err.data.error : "HTTP_ERROR",
        err.success ? (err.data.message ?? err.data.error) : `HTTP ${res.status} for ${path}`,
        res.status,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiClientError("INVALID_RESPONSE", `Unexpected response for ${path}: ${parsed.error.message}`, res.status);
    }
    return parsed.data;
  }

  return {
    /** Fetches the sign track, polling while it is processing, until it is ready or has an error. */
    async getSignTrack(videoId: string, lang: SignLang = "ASL", opts: GetSignTrackOptions = {}): Promise<SignTrack> {
      if (mock) {
        opts.onProgress?.(1);
        return { ...SignTrackSchema.parse(sampleTrack), videoId, lang };
      }
      const interval = opts.pollIntervalMs ?? 2000;
      const deadline = Date.now() + (opts.timeoutMs ?? 5 * 60_000);
      const path = `/api/sign-track?videoId=${encodeURIComponent(videoId)}&lang=${lang}`;
      let partialCount = 0;
      for (;;) {
        const track = await get(path, SignTrackSchema, opts.signal);
        if (track.status !== "processing") {
          if (track.status === "ready") opts.onProgress?.(1);
          return track;
        }
        opts.onProgress?.(track.progress ?? 0);
        if (opts.onPartial && track.segments.length > partialCount) {
          partialCount = track.segments.length;
          opts.onPartial(track);
        }
        if (Date.now() + interval > deadline) {
          throw new ApiClientError("TIMEOUT", `Sign track for ${videoId} was still processing after the timeout`);
        }
        await sleep(interval, opts.signal);
      }
    },

    /** Glosses the avatar can play. */
    async getSigns(lang: SignLang = "ASL", signal?: AbortSignal): Promise<string[]> {
      if (mock) return MOCK_SIGNS;
      return get(`/api/signs?lang=${lang}`, z.array(z.string()), signal);
    },

    /** YouTube videos about a topic, found with Exa. */
    async discover(q: string, signal?: AbortSignal): Promise<DiscoverResult[]> {
      if (mock) {
        return [
          {
            videoId: "sample-volcanoes",
            title: `Mock result for "${q}"`,
            url: "https://www.youtube.com/watch?v=sample-volcanoes",
            snippet: "A short lesson about volcanoes (mock data).",
            thumbnail: "https://i.ytimg.com/vi/sample-volcanoes/hqdefault.jpg",
          },
        ];
      }
      return get(`/api/discover?q=${encodeURIComponent(q)}`, z.array(DiscoverResultSchema), signal);
    },

    /** How-to-sign pages for a word, found with Exa. */
    async signReference(word: string, signal?: AbortSignal): Promise<SignReference[]> {
      if (mock) {
        return [{ title: `How to sign "${word}" (mock)`, url: "https://www.lifeprint.com/", source: "lifeprint.com" }];
      }
      return get(`/api/sign-reference?word=${encodeURIComponent(word)}`, z.array(SignReferenceSchema), signal);
    },

    async health(signal?: AbortSignal): Promise<Health> {
      if (mock) return { ok: true, cerebras: false, exa: false };
      return get("/api/health", HealthSchema, signal);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
