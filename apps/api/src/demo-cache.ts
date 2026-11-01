/**
 * Demo readiness (spec §4–5): warm the cache for the demo videos, pre-run Discover queries,
 * pre-fetch sign references, and export/import the cache so the demo laptop works offline.
 */
import type { DiscoverResult, SignLang, SignReference, SignTrack, VideoContext } from "@signstream/shared";
import { SignTrackSchema } from "@signstream/shared";
import { cacheKeys, type Cache } from "./cache";
import type { JobManager } from "./jobs";

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface WarmResult {
  videoId: string;
  status: SignTrack["status"];
  error?: string;
  segments: number;
  fromCache: boolean;
}

/** Builds (or rebuilds with `refresh`) the sign tracks for the demo videos, one at a time. */
export async function warmVideos(jobs: JobManager, videoIds: string[], lang: SignLang = "ASL", refresh = false): Promise<WarmResult[]> {
  const results: WarmResult[] = [];
  for (const videoId of videoIds) {
    const found = jobs.lookup(videoId, lang, { refresh })!;
    const track = found.cached ? found.track : ((await jobs.wait(videoId, lang)) ?? found.track);
    results.push({ videoId, status: track.status, error: track.error, segments: track.segments.length, fromCache: found.cached });
  }
  return results;
}

/** Runs Discover queries now so the demo searches come from the cache (1 hour TTL, like the API). */
export async function prerunDiscover(cache: Cache, discover: (q: string) => Promise<DiscoverResult[]>, queries: string[], ttlSeconds = 60 * 60) {
  return mapLimit(queries, 2, async (q) => {
    const results = await discover(q);
    cache.set(cacheKeys.discover(q), results, ttlSeconds);
    return { q, results: results.length };
  });
}

/** Fetches sign references for words that aren't cached yet. Failures are reported, not thrown. */
export async function prefetchSignReferences(
  cache: Cache,
  signReference: (word: string) => Promise<SignReference[]>,
  words: string[],
  concurrency = 4,
) {
  let fetched = 0;
  let skipped = 0;
  const failed: string[] = [];
  await mapLimit(words, concurrency, async (word) => {
    const key = cacheKeys.signReference(word);
    if (cache.get(key) !== undefined) {
      skipped++;
      return;
    }
    try {
      cache.set(key, await signReference(word));
      fetched++;
    } catch {
      failed.push(word);
    }
  });
  return { fetched, skipped, failed };
}

/** Everything the offline demo needs, as plain JSON (mocks/demo-cache/cache.json). */
export interface DemoCacheFile {
  version: 1;
  exportedAt: string;
  tracks: SignTrack[];
  contexts: Record<string, VideoContext>;
  discover: Record<string, DiscoverResult[]>;
  signReferences: Record<string, SignReference[]>;
}

const suffix = (key: string, prefix: string) => key.slice(prefix.length);

/** Exports ready tracks, contexts, Discover results and sign references. Error tracks are left out. */
export function exportCache(cache: Cache, now = new Date()): DemoCacheFile {
  const tracks = cache
    .keys("track:")
    .map((k) => cache.get<SignTrack>(k))
    .filter((t): t is SignTrack => t?.status === "ready");
  const pick = <T>(prefix: string) => Object.fromEntries(cache.keys(prefix).map((k) => [suffix(k, prefix), cache.get<T>(k)!]));
  return {
    version: 1,
    exportedAt: now.toISOString(),
    tracks,
    contexts: pick<VideoContext>("context:"),
    discover: pick<DiscoverResult[]>("discover:"),
    signReferences: pick<SignReference[]>("signref:"),
  };
}

/** Loads an exported file into the cache. Discover results are kept forever so the offline demo works. */
export function importCache(cache: Cache, file: DemoCacheFile) {
  if (file.version !== 1) throw new Error(`Unsupported demo cache version: ${String(file.version)}`);
  for (const t of file.tracks) {
    const track = SignTrackSchema.parse(t);
    cache.set(cacheKeys.track(track.videoId, track.lang), track);
  }
  for (const [videoId, ctx] of Object.entries(file.contexts)) cache.set(cacheKeys.context(videoId), ctx);
  for (const [q, results] of Object.entries(file.discover)) cache.set(cacheKeys.discover(q), results);
  for (const [word, refs] of Object.entries(file.signReferences)) cache.set(cacheKeys.signReference(word), refs);
  return {
    tracks: file.tracks.length,
    contexts: Object.keys(file.contexts).length,
    discover: Object.keys(file.discover).length,
    signReferences: Object.keys(file.signReferences).length,
  };
}
