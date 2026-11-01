/** Production entry point: wires real services and starts the Bun server. */
import { createApp } from "./app";
import { createSqliteCache } from "./cache";
import { createDictionary } from "./dictionary";
import { describeEnv, loadEnv } from "./env";
import { createExaSearch, discoverVideos, findSignReferences, getVideoContext } from "./exa";
import { textToSigns } from "./gloss";
import { createJobManager } from "./jobs";
import { getTranscript, youtubeSource } from "./transcript";
import { cacheKeys } from "./cache";
import type { VideoContext } from "@signstream/shared";

const env = loadEnv();
const cache = createSqliteCache(env.DATABASE_URL);
const dictionary = createDictionary();
const exa = createExaSearch(env.EXA_API_KEY);
const youtube = youtubeSource();

const jobs = createJobManager({
  cache,
  deps: {
    getTranscript: (videoId) => getTranscript(videoId, youtube),
    async getContext(videoId, title, description) {
      const key = cacheKeys.context(videoId);
      const cached = cache.get<VideoContext>(key);
      if (cached) return cached;
      const ctx = await getVideoContext(exa, title, description, {
        onError: (e) => console.log(`exa context failed for ${videoId}: ${(e as Error).message}`),
      });
      if (ctx) cache.set(key, ctx);
      return ctx;
    },
    textToSigns,
    dictionary,
    maxVideoSeconds: env.MAX_VIDEO_SECONDS,
  },
});

const app = createApp({
  env,
  cache,
  jobs,
  dictionary,
  discover: exa && ((q) => discoverVideos(exa, q)),
  signReference: exa && ((word) => findSignReferences(exa, word)),
});

console.log("SignStream API config", describeEnv(env));
console.log(`SignStream API on http://localhost:${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
