import { describe, expect, it } from "bun:test";
import type { SignTrack } from "../contracts";
import { buildMockTrack } from "../mock-track";
import { createTrackCache, pollSignTrack, SignTrackError } from "./sign-track-source";

const VIDEO = "dQw4w9WgXcQ";
const ready = buildMockTrack(VIDEO, "ASL", 30);
const processing = (progress: number): SignTrack => ({ ...ready, status: "processing", progress, segments: [] });

/** A fetch that returns the given responses in order (the last one repeats) and records the URLs it was called with. */
function fakeFetch(responses: (Response | Error)[]) {
  const urls: string[] = [];
  let i = 0;
  const fn = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const next = responses[Math.min(i++, responses.length - 1)]!;
    if (next instanceof Error) throw next;
    return next.clone();
  }) as typeof fetch;
  return { fn, urls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const poll = (fetch: typeof globalThis.fetch, extra: Partial<Parameters<typeof pollSignTrack>[0]> = {}) =>
  pollSignTrack({ baseUrl: "http://api.test", videoId: VIDEO, lang: "ASL", fetch, intervalMs: 1, ...extra });

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "resolved";
  } catch (err) {
    return err instanceof SignTrackError ? err.code : String(err);
  }
};

describe("pollSignTrack", () => {
  it("calls GET /api/sign-track with the video and language", async () => {
    const { fn, urls } = fakeFetch([json(ready)]);
    await poll(fn);
    expect(urls).toEqual([`http://api.test/api/sign-track?videoId=${VIDEO}&lang=ASL`]);
  });

  it("polls while processing, reports progress, and returns the ready track", async () => {
    const { fn, urls } = fakeFetch([json(processing(0.1)), json(processing(0.4)), json(ready)]);
    const progress: number[] = [];
    const track = await poll(fn, { onProgress: (p) => progress.push(p) });
    expect(track.status).toBe("ready");
    expect(track.segments.length).toBe(ready.segments.length);
    expect(progress).toEqual([0.1, 0.4]);
    expect(urls.length).toBe(3);
  });

  it("passes the API's error code through (e.g. NO_CAPTIONS)", async () => {
    const { fn } = fakeFetch([json({ ...processing(0), status: "error", error: "NO_CAPTIONS" })]);
    expect(await codeOf(poll(fn))).toBe("NO_CAPTIONS");
  });

  it("maps HTTP 429 to RATE_LIMITED", async () => {
    const { fn } = fakeFetch([json({ message: "slow down" }, 429)]);
    expect(await codeOf(poll(fn))).toBe("RATE_LIMITED");
  });

  it("rejects a response that isn't a sign track", async () => {
    const { fn } = fakeFetch([json({ hello: "world" })]);
    expect(await codeOf(poll(fn))).toBe("INVALID_RESPONSE");
    const { fn: html500 } = fakeFetch([new Response("<h1>oops</h1>", { status: 500 })]);
    expect(await codeOf(poll(html500))).toBe("HTTP_500");
  });

  it("retries network failures, then gives up with NETWORK", async () => {
    const flaky = fakeFetch([new TypeError("offline"), json(ready)]);
    expect((await poll(flaky.fn)).status).toBe("ready");

    const down = fakeFetch([new TypeError("offline")]);
    expect(await codeOf(poll(down.fn, { maxNetworkFailures: 3 }))).toBe("NETWORK");
    expect(down.urls.length).toBe(3);
  });

  it("times out if the track never finishes", async () => {
    const { fn, urls } = fakeFetch([json(processing(0.5))]);
    expect(await codeOf(poll(fn, { maxAttempts: 4 }))).toBe("TIMEOUT");
    expect(urls.length).toBe(4);
  });

  it("stops polling when aborted (the user left the video)", async () => {
    const { fn, urls } = fakeFetch([json(processing(0.2))]);
    const controller = new AbortController();
    const result = poll(fn, { signal: controller.signal, intervalMs: 50, onProgress: () => controller.abort() });
    expect(await codeOf(result)).not.toBe("resolved");
    expect(urls.length).toBe(1);
  });
});

describe("createTrackCache", () => {
  const memoryArea = () => {
    const data: Record<string, unknown> = {};
    return {
      data,
      get: (async (key: string) => ({ [key]: data[key] })) as unknown as chrome.storage.StorageArea["get"],
      set: (async (items: Record<string, unknown>) => void Object.assign(data, items)) as chrome.storage.StorageArea["set"],
    };
  };

  it("stores ready tracks per video and language", async () => {
    const area = memoryArea();
    const cache = createTrackCache(area);
    await cache.set(ready);
    expect((await cache.get(VIDEO, "ASL"))?.segments.length).toBe(ready.segments.length);
    expect(await cache.get(VIDEO, "ISL")).toBeUndefined();
    expect(await cache.get("other-video", "ASL")).toBeUndefined();
  });

  it("never caches unfinished tracks", async () => {
    const area = memoryArea();
    const cache = createTrackCache(area);
    await cache.set(processing(0.5));
    expect(Object.keys(area.data)).toEqual([]);
  });
});
