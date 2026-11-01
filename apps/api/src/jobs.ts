/**
 * Job manager (spec §3): a cache miss starts one background job per video+language;
 * concurrent requests share it. Ready tracks are cached forever, error tracks for a short time.
 */
import type { SignLang, SignTrack } from "@signstream/shared";
import { cacheKeys, type Cache } from "./cache";
import { buildSignTrack, formatMetrics, type PipelineDeps } from "./pipeline";
import type { Transcript } from "./transcript";

export interface JobManagerOptions {
  cache: Cache;
  deps: PipelineDeps;
  log?: (line: string) => void;
  /** How long to remember errors (so a broken video isn't retried on every poll). */
  errorTtlSeconds?: number;
}

export interface TrackLookup {
  track: SignTrack;
  /** true when this call started a new job (used for the new-video rate limit). */
  started: boolean;
  cached: boolean;
}

export function createJobManager({ cache, deps, log = console.log, errorTtlSeconds = 600 }: JobManagerOptions) {
  const running = new Map<string, { track: SignTrack; done: Promise<SignTrack> }>();

  function start(videoId: string, lang: SignLang, manual?: Transcript): { track: SignTrack; done: Promise<SignTrack> } {
    const key = cacheKeys.track(videoId, lang);
    const job = {
      track: { videoId, lang, source: manual ? "manual" : "youtube-captions", status: "processing", progress: 0, segments: [] } as SignTrack,
      done: Promise.resolve(undefined as unknown as SignTrack),
    };
    const jobDeps = manual ? { ...deps, getTranscript: async () => manual } : deps;
    job.done = buildSignTrack(
      videoId,
      lang,
      jobDeps,
      (p, segments) => {
        job.track = { ...job.track, progress: Math.round(p * 100) / 100, ...(segments ? { segments } : {}) };
      },
      manual ? "manual" : "youtube-captions",
    )
      .then(({ track, metrics }) => {
        cache.set(key, track, track.status === "ready" ? undefined : errorTtlSeconds);
        log(formatMetrics(metrics));
        return track;
      })
      .finally(() => running.delete(key));
    running.set(key, job);
    return job;
  }

  return {
    /** Returns the cached track, the running job's state, or starts a new job. */
    lookup(videoId: string, lang: SignLang, opts: { refresh?: boolean; allowStart?: boolean } = {}): TrackLookup | undefined {
      const key = cacheKeys.track(videoId, lang);
      const running_ = running.get(key);
      if (running_) return { track: running_.track, started: false, cached: false };
      if (opts.refresh) cache.delete(key);
      const cached = cache.get<SignTrack>(key);
      if (cached) return { track: cached, started: false, cached: true };
      if (opts.allowStart === false) return undefined;
      return { track: start(videoId, lang).track, started: true, cached: false };
    },
    /** Glosses uploaded captions (manual .vtt fallback), replacing any cached track. Returns undefined if a job is running. */
    startManual(videoId: string, lang: SignLang, manual: Transcript): SignTrack | undefined {
      const key = cacheKeys.track(videoId, lang);
      if (running.has(key)) return undefined;
      cache.delete(key);
      return start(videoId, lang, manual).track;
    },
    /** Waits for a running job (tests, cache warming). */
    async wait(videoId: string, lang: SignLang): Promise<SignTrack | undefined> {
      const key = cacheKeys.track(videoId, lang);
      return running.has(key) ? running.get(key)!.done : cache.get<SignTrack>(key);
    },
    runningCount: () => running.size,
  };
}

export type JobManager = ReturnType<typeof createJobManager>;
