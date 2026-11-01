/** Builds the real services from the environment. Shared by the server (index.ts) and the demo CLI. */
import type { VideoContext } from "@signstream/shared";
import type { AppServices } from "./app";
import { cacheKeys, createSqliteCache } from "./cache";
import { createDictionary } from "./dictionary";
import type { Env } from "./env";
import { createExaSearch, discoverVideos, findSignReferences, getVideoContext } from "./exa";
import { textToSigns } from "./gloss";
import { createJobManager } from "./jobs";
import { getTranscript, youtubeSource } from "./transcript";

export function createServices(env: Env, log: (line: string) => void = console.log): AppServices {
  const cache = createSqliteCache(env.DATABASE_URL);
  const dictionary = createDictionary();
  const exa = createExaSearch(env.EXA_API_KEY);
  const youtube = youtubeSource();

  const jobs = createJobManager({
    cache,
    log,
    deps: {
      getTranscript: (videoId) => getTranscript(videoId, youtube),
      async getContext(videoId, title, description) {
        const key = cacheKeys.context(videoId);
        const cached = cache.get<VideoContext>(key);
        if (cached) return cached;
        const ctx = await getVideoContext(exa, title, description, {
          onError: (e) => log(`exa context failed for ${videoId}: ${(e as Error).message}`),
        });
        if (ctx) cache.set(key, ctx);
        return ctx;
      },
      textToSigns,
      dictionary,
      maxVideoSeconds: env.MAX_VIDEO_SECONDS,
    },
  });

  return {
    env,
    cache,
    jobs,
    dictionary,
    discover: exa && ((q) => discoverVideos(exa, q)),
    signReference: exa && ((word) => findSignReferences(exa, word)),
    log,
  };
}
