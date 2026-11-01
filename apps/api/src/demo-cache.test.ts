import { describe, expect, it } from "bun:test";
import type { SignTrack } from "@signstream/shared";
import { createSqliteCache } from "./cache";
import { exportCache, importCache, mapLimit, prefetchSignReferences, prerunDiscover, warmVideos } from "./demo-cache";
import { createJobManager } from "./jobs";
import { COMMON_WORDS } from "./scripts/common-words";
import { VIDEO, fakeDeps } from "./test-helpers";

const OTHER = "bbbbbbbbbbb";

describe("mapLimit", () => {
  it("keeps order and never runs more than the limit at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      peak = Math.max(peak, ++inFlight);
      await Bun.sleep(2);
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});

describe("warmVideos", () => {
  it("builds tracks once, then reports them as cached; refresh rebuilds", async () => {
    const deps = fakeDeps();
    const cache = createSqliteCache(":memory:");
    const jobs = createJobManager({ cache, deps, log: () => {} });
    expect(await warmVideos(jobs, [VIDEO, OTHER])).toEqual([
      { videoId: VIDEO, status: "ready", error: undefined, segments: 3, fromCache: false },
      { videoId: OTHER, status: "ready", error: undefined, segments: 3, fromCache: false },
    ]);
    expect((await warmVideos(jobs, [VIDEO]))[0]!.fromCache).toBe(true);
    expect(deps.calls.transcript).toBe(2);
    await warmVideos(jobs, [VIDEO], "ASL", true);
    expect(deps.calls.transcript).toBe(3);
  });
});

describe("prerunDiscover and prefetchSignReferences", () => {
  it("fill the cache and skip words already cached", async () => {
    const cache = createSqliteCache(":memory:");
    await prerunDiscover(cache, async (q) => [{ videoId: VIDEO, title: q, url: `https://www.youtube.com/watch?v=${VIDEO}`, snippet: "", thumbnail: "https://i.ytimg.com/x.jpg" }], ["Volcanoes"]);
    expect(cache.get("discover:volcanoes")).toHaveLength(1);

    let calls = 0;
    const fetchRefs = async (word: string) => {
      calls++;
      if (word === "broken") throw new Error("exa down");
      return [{ title: word, url: "https://www.lifeprint.com/x", source: "lifeprint.com" }];
    };
    expect(await prefetchSignReferences(cache, fetchRefs, ["hello", "water", "broken"])).toEqual({ fetched: 2, skipped: 0, failed: ["broken"] });
    expect(await prefetchSignReferences(cache, fetchRefs, ["hello", "water"])).toEqual({ fetched: 0, skipped: 2, failed: [] });
    expect(calls).toBe(3);
  });
});

describe("export and import", () => {
  it("round-trips ready tracks and Exa results, and leaves error tracks out", async () => {
    const source = createSqliteCache(":memory:");
    const jobs = createJobManager({ cache: source, deps: fakeDeps(), log: () => {} });
    await warmVideos(jobs, [VIDEO]);
    source.set(`track:${OTHER}:ASL`, { videoId: OTHER, lang: "ASL", source: "youtube-captions", status: "error", error: "NO_CAPTIONS", segments: [] } satisfies SignTrack, 600);
    source.set("context:" + VIDEO, { topic: "Volcanoes", names: [], terms: [] });
    source.set("discover:volcanoes", []);
    source.set("signref:hello", [{ title: "HELLO", url: "https://www.lifeprint.com/x", source: "lifeprint.com" }]);

    const file = exportCache(source, new Date("2026-11-01T00:00:00Z"));
    expect(file.tracks.map((t) => t.videoId)).toEqual([VIDEO]);
    expect(Object.keys(file.signReferences)).toEqual(["hello"]);

    const target = createSqliteCache(":memory:");
    expect(importCache(target, JSON.parse(JSON.stringify(file)))).toEqual({ tracks: 1, contexts: 1, discover: 1, signReferences: 1 });
    const offlineDeps = fakeDeps({
      getTranscript: async () => {
        throw new Error("no internet");
      },
    });
    const offline = createJobManager({ cache: target, deps: offlineDeps, log: () => {} });
    const hit = offline.lookup(VIDEO, "ASL")!;
    expect(hit.cached).toBe(true);
    expect(hit.track.status).toBe("ready");
    expect(offlineDeps.calls.transcript).toBe(0);
  });

  it("rejects an unknown file version", () => {
    expect(() => importCache(createSqliteCache(":memory:"), { version: 2 } as never)).toThrow(/version/);
  });
});

describe("COMMON_WORDS", () => {
  it("has 500 unique lowercase words", () => {
    expect(COMMON_WORDS).toHaveLength(500);
    expect(new Set(COMMON_WORDS).size).toBe(500);
    expect(COMMON_WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true);
  });
});
