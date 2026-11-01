#!/usr/bin/env bun
/**
 * Demo readiness CLI (spec §4–5). Uses the same env and SQLite cache as the server.
 *
 *   pnpm --filter @signstream/api demo warm <videoId...>         build sign tracks for the demo videos
 *   pnpm --filter @signstream/api demo refresh <videoId...>      rebuild them after a prompt change
 *   pnpm --filter @signstream/api demo stale                     list cached tracks built with an older gloss/dictionary/model
 *   pnpm --filter @signstream/api demo refresh --stale           rebuild exactly those
 *   pnpm --filter @signstream/api demo discover "<query>"...     pre-run Discover searches
 *   pnpm --filter @signstream/api demo sign-refs [count]         pre-fetch sign references (default 500 words)
 *   pnpm --filter @signstream/api demo export [file]             write mocks/demo-cache/cache.json
 *   pnpm --filter @signstream/api demo import [file]             load it (offline demo laptop)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exportCache, findStaleTracks, importCache, prefetchSignReferences, prerunDiscover, warmVideos, type DemoCacheFile } from "../demo-cache";
import { createDictionary } from "../dictionary";
import { dictionaryRevision, gitCommit, glossRevision, type TrackRevision } from "../revision";
import { describeEnv, loadEnv } from "../env";
import { createServices } from "../services";
import { COMMON_WORDS } from "./common-words";

const DEFAULT_FILE = resolve(import.meta.dir, "../../../../mocks/demo-cache/cache.json");
const [command, ...args] = process.argv.slice(2);

const env = loadEnv();
const services = createServices(env);
console.log("config", describeEnv(env));
const dictionary = createDictionary();
const gloss = glossRevision();
const current = (lang: "ASL" | "ISL"): TrackRevision => ({ gloss, dictionary: dictionaryRevision(dictionary(lang)), model: env.CEREBRAS_MODEL });
const describeRev = (r?: TrackRevision) => (r ? `gloss=${r.gloss} dictionary=${r.dictionary} model=${r.model}` : "unknown (built before revisions)");

switch (command) {
  case "stale": {
    const stale = findStaleTracks(services.cache, current);
    console.log(`current: ${describeRev(current("ASL"))}`);
    for (const t of stale) console.log(`stale ${t.videoId}:${t.lang} built with ${describeRev(t.builtWith)}`);
    console.log(stale.length ? `${stale.length} stale track(s). Rebuild: demo refresh --stale` : "All cached tracks are current.");
    break;
  }
  case "warm":
  case "refresh": {
    const ids = command === "refresh" && args[0] === "--stale" ? findStaleTracks(services.cache, current).map((t) => t.videoId) : args;
    if (ids.length === 0) {
      if (args[0] === "--stale") console.log("No stale tracks.");
      else throw new Error(`Usage: demo ${command} <videoId...>`);
    }
    for (const r of await warmVideos(services.jobs, ids, "ASL", command === "refresh")) {
      console.log(`${r.videoId}: ${r.status}${r.error ? ` (${r.error})` : ""}, ${r.segments} segments${r.fromCache ? " (cached)" : ""}`);
    }
    break;
  }
  case "discover": {
    if (!services.discover) throw new Error("EXA_API_KEY is not set");
    if (args.length === 0) throw new Error('Usage: demo discover "<query>"...');
    for (const r of await prerunDiscover(services.cache, services.discover, args)) console.log(`"${r.q}": ${r.results} videos`);
    break;
  }
  case "sign-refs": {
    if (!services.signReference) throw new Error("EXA_API_KEY is not set");
    const count = Number(args[0] ?? COMMON_WORDS.length);
    const words = COMMON_WORDS.slice(0, count);
    console.log(`Fetching sign references for ${words.length} words (cached words are skipped)...`);
    const r = await prefetchSignReferences(services.cache, services.signReference, words);
    console.log(`fetched ${r.fetched}, already cached ${r.skipped}, failed ${r.failed.length}${r.failed.length ? `: ${r.failed.join(", ")}` : ""}`);
    break;
  }
  case "export": {
    const file = resolve(args[0] ?? DEFAULT_FILE);
    const data = exportCache(services.cache, new Date(), { commit: gitCommit(), revision: current("ASL") });
    const stale = findStaleTracks(services.cache, current);
    if (stale.length) console.warn(`warning: ${stale.length} exported track(s) are stale: ${stale.map((t) => t.videoId).join(", ")}. Run demo refresh --stale first.`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`wrote ${file}: ${data.tracks.length} tracks, ${Object.keys(data.discover).length} searches, ${Object.keys(data.signReferences).length} sign references`);
    break;
  }
  case "import": {
    const file = resolve(args[0] ?? DEFAULT_FILE);
    const counts = importCache(services.cache, JSON.parse(readFileSync(file, "utf8")) as DemoCacheFile);
    console.log(`imported ${file}:`, counts);
    break;
  }
  default:
    console.log("Usage: demo <warm|refresh|stale|discover|sign-refs|export|import> [args]");
    process.exitCode = 1;
}
services.cache.close();
