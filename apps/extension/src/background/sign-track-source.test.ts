import { describe, expect, it } from "bun:test";
import type { SignTrack } from "@signstream/shared";
import { sampleTrack } from "../../test/fixtures";
import { createTrackCache, loadSignTrack, SignTrackFailure, type LoadOptions } from "./sign-track-source";

const VIDEO = "dQw4w9WgXcQ";
const ready = sampleTrack(VIDEO);
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

function memoryArea() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: (async (key: string) => ({ [key]: data[key] })) as unknown as chrome.storage.StorageArea["get"],
    set: (async (items: Record<string, unknown>) => void Object.assign(data, items)) as chrome.storage.StorageArea["set"],
  };
}

function load(fetch: typeof globalThis.fetch, extra: Partial<LoadOptions> = {}) {
  return loadSignTrack({
    videoId: VIDEO,
    lang: "ASL",
    mock: false,
    apiOrigin: "http://api.test",
    cache: createTrackCache(memoryArea()),
    signal: new AbortController().signal,
    fetch,
    pollIntervalMs: 1,
    retryDelayMs: 1,
    ...extra,
  });
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "resolved";
  } catch (err) {
    return err instanceof SignTrackFailure ? err.code : String(err);
  }
};

describe("loadSignTrack (shared createApiClient in the worker)", () => {
  it("calls GET /api/sign-track on the fixed origin", async () => {
    const { fn, urls } = fakeFetch([json(ready)]);
    const { source } = await load(fn);
    expect(source).toBe("api");
    expect(urls).toEqual([`http://api.test/api/sign-track?videoId=${VIDEO}&lang=ASL`]);
  });

  it("polls while processing, reports progress, and returns the validated ready track", async () => {
    const { fn, urls } = fakeFetch([json(processing(0.1)), json(processing(0.4)), json(ready)]);
    const progress: number[] = [];
    const { track } = await load(fn, { onProgress: (p) => progress.push(p) });
    expect(track.segments.length).toBe(ready.segments.length);
    expect(progress).toEqual([0.1, 0.4, 1]);
    expect(urls.length).toBe(3);
  });

  it("passes the API's track error through (e.g. NO_CAPTIONS)", async () => {
    const { fn } = fakeFetch([json({ ...processing(0), status: "error", error: "NO_CAPTIONS" })]);
    expect(await codeOf(load(fn))).toBe("NO_CAPTIONS");
  });

  it("uses the API's error code for HTTP errors (429 RATE_LIMITED)", async () => {
    const { fn } = fakeFetch([json({ error: "RATE_LIMITED", message: "slow down" }, 429)]);
    expect(await codeOf(load(fn))).toBe("RATE_LIMITED");
  });

  it("rejects a response that doesn't match the shared schema", async () => {
    const { fn } = fakeFetch([json({ hello: "world" })]);
    expect(await codeOf(load(fn))).toBe("INVALID_RESPONSE");
  });

  it("retries when the API can't be reached, then gives up with NETWORK", async () => {
    const flaky = fakeFetch([new TypeError("offline"), json(ready)]);
    expect((await load(flaky.fn)).track.status).toBe("ready");

    const down = fakeFetch([new TypeError("offline")]);
    expect(await codeOf(load(down.fn, { networkRetries: 2 }))).toBe("NETWORK");
    expect(down.urls.length).toBe(3);
  });

  it("passes cumulative partial snapshots on while processing", async () => {
    const withSegments = (n: number, progress: number): SignTrack => ({
      ...ready,
      status: "processing",
      progress,
      segments: ready.segments.slice(0, n),
    });
    const { fn } = fakeFetch([json(withSegments(2, 0.2)), json(withSegments(2, 0.3)), json(withSegments(5, 0.6)), json(ready)]);
    const partials: number[] = [];
    await load(fn, { onPartial: (t) => partials.push(t.segments.length) });
    expect(partials).toEqual([2, 5]); // only when there are new segments
  });

  it("stops polling when aborted (the requester left the video)", async () => {
    const { fn, urls } = fakeFetch([json(processing(0.2))]);
    const controller = new AbortController();
    const result = load(fn, { signal: controller.signal, pollIntervalMs: 50, onProgress: () => controller.abort() });
    expect(await codeOf(result)).not.toBe("resolved");
    expect(urls.length).toBe(1);
  });

  it("serves a cached ready track without calling the API", async () => {
    const area = memoryArea();
    const cache = createTrackCache(area);
    await cache.set(ready);
    const { fn, urls } = fakeFetch([json(ready)]);
    expect((await load(fn, { cache })).source).toBe("cache");
    expect(urls).toEqual([]);
  });

  it("demo mode returns the shared mock for this video without fetching", async () => {
    const { fn, urls } = fakeFetch([json(ready)]);
    const { track, source } = await load(fn, { mock: true, videoId: "abcdefghijk" });
    expect(source).toBe("mock");
    expect(track.videoId).toBe("abcdefghijk");
    expect(track.segments[0]?.text).toBe("Hello everyone, my name is Bob.");
    expect(urls).toEqual([]);
  });
});

describe("createTrackCache", () => {
  it("stores ready tracks per video and language", async () => {
    const cache = createTrackCache(memoryArea());
    await cache.set(ready);
    expect((await cache.get(VIDEO, "ASL"))?.segments.length).toBe(ready.segments.length);
    expect(await cache.get(VIDEO, "ISL")).toBeUndefined();
    expect(await cache.get("other-video", "ASL")).toBeUndefined();
  });

  it("never caches unfinished tracks, and ignores invalid cache entries", async () => {
    const area = memoryArea();
    const cache = createTrackCache(area);
    await cache.set(processing(0.5));
    expect(Object.keys(area.data)).toEqual([]);
    area.data[`track:ASL:${VIDEO}`] = { status: "ready", segments: "nope" };
    expect(await cache.get(VIDEO, "ASL")).toBeUndefined();
  });
});
