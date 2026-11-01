/** Builds the real services from the environment. Shared by the server (index.ts) and the demo CLI. */
import type { VideoContext } from "@signstream/shared";
import type { AppServices } from "./app";
import { cacheKeys, createSqliteCache } from "./cache";
import { createDictionary } from "./dictionary";
import type { Env } from "./env";
import { createExaSearch, discoverVideos, findSignReferences, getVideoContext } from "./exa";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { createGlossTranslator } from "./gloss";
import { createJobManager } from "./jobs";
import { dictionaryRevision, glossRevision } from "./revision";
import { cerebrasBudgetDefaults, createRequestBudget, type RequestBudget } from "./provider-budget";
import { getTranscript, youtubeSource } from "./transcript";

type GlossComplete = NonNullable<NonNullable<Parameters<typeof createGlossTranslator>[0]>["complete"]>;

/** Durgesh's translator, with every Cerebras call (including its retries) going through the account-wide budget. */
export function createBudgetedTranslator(env: Env, budget: RequestBudget, complete?: GlossComplete) {
  let call = complete;
  if (!call && env.CEREBRAS_API_KEY) {
    const client = new Cerebras({ apiKey: env.CEREBRAS_API_KEY, maxRetries: 0, timeout: 15_000 });
    call = async (request) =>
      (await client.chat.completions.create({ ...request, stream: false })) as Awaited<ReturnType<GlossComplete>>;
  }
  return createGlossTranslator({
    model: env.CEREBRAS_MODEL,
    complete:
      call &&
      ((request) =>
        budget.run(() => call(request), {
          tokens: estimateGlossTokens(request),
          actual: (response) => response.usage?.total_tokens,
        })),
  });
}

/**
 * Up-front token estimate for one gloss call, replaced by real usage when it returns. Measured on
 * 2026-11-01: a 40-caption batch used ~5k tokens (~1k prompt, ~2-4k completion incl. reasoning).
 */
export function estimateGlossTokens(request: Parameters<GlossComplete>[0]): number {
  const promptChars = request.messages.reduce((sum, m) => sum + m.content.length, 0);
  let segments = 0;
  try {
    segments = (JSON.parse(request.messages.at(-1)?.content ?? "{}") as { segments?: unknown[] }).segments?.length ?? 0;
  } catch {
    // not a gloss batch; prompt size alone
  }
  return Math.ceil(promptChars / 4) + 90 * segments + 1500;
}

export function createCerebrasBudget(env: Env): RequestBudget {
  const defaults = cerebrasBudgetDefaults(env.CEREBRAS_TIER);
  return createRequestBudget({
    perMinute: env.CEREBRAS_REQUESTS_PER_MINUTE ?? defaults.perMinute,
    perHour: defaults.perHour,
    tokensPerMinute: env.CEREBRAS_TOKENS_PER_MINUTE ?? defaults.tokensPerMinute,
    concurrency: env.CEREBRAS_MAX_CONCURRENT ?? defaults.concurrency,
  });
}

export function createServices(env: Env, log: (line: string) => void = console.log): AppServices {
  const cache = createSqliteCache(env.DATABASE_URL);
  const dictionary = createDictionary();
  const exa = createExaSearch(env.EXA_API_KEY);
  const youtube = youtubeSource();
  const cerebrasBudget = createCerebrasBudget(env);
  const textToSigns = createBudgetedTranslator(env, cerebrasBudget);

  const gloss = glossRevision();
  const jobs = createJobManager({
    cache,
    log,
    revision: (lang) => ({ gloss, dictionary: dictionaryRevision(dictionary(lang)), model: env.CEREBRAS_MODEL }),
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
