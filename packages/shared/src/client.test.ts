import { describe, expect, it } from "bun:test";
import { ApiClientError, createApiClient } from "./client";
import type { SignTrack } from "./schemas";

const track = (over: Partial<SignTrack>): SignTrack => ({
  videoId: "abc",
  lang: "ASL",
  source: "youtube-captions",
  status: "ready",
  segments: [],
  ...over,
});

/** A fake fetch that returns the given responses in order and records the URLs. */
function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const urls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    const r = responses.shift();
    if (!r) throw new Error("no more fake responses");
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { fn, urls };
}

describe("getSignTrack", () => {
  it("polls while processing, reports progress, and returns the ready track", async () => {
    const { fn, urls } = fakeFetch([
      { body: track({ status: "processing", progress: 0.2 }) },
      { body: track({ status: "processing", progress: 0.7 }) },
      { body: track({ status: "ready" }) },
    ]);
    const progress: number[] = [];
    const client = createApiClient({ baseUrl: "http://api.test/", fetch: fn, mock: false });
    const result = await client.getSignTrack("abc", "ASL", { pollIntervalMs: 1, onProgress: (p) => progress.push(p) });
    expect(result.status).toBe("ready");
    expect(progress).toEqual([0.2, 0.7, 1]);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("http://api.test/api/sign-track?videoId=abc&lang=ASL");
  });

  it("returns an error track without throwing", async () => {
    const { fn } = fakeFetch([{ body: track({ status: "error", error: "NO_CAPTIONS" }) }]);
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fn, mock: false });
    expect((await client.getSignTrack("abc")).error).toBe("NO_CAPTIONS");
  });

  it("throws TIMEOUT when it stays processing", async () => {
    const { fn } = fakeFetch(Array.from({ length: 10 }, () => ({ body: track({ status: "processing" }) })));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fn, mock: false });
    const err = await client.getSignTrack("abc", "ASL", { pollIntervalMs: 5, timeoutMs: 12 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("TIMEOUT");
  });
});

describe("errors", () => {
  it("turns an API error body into ApiClientError with status and code", async () => {
    const { fn } = fakeFetch([{ status: 429, body: { error: "RATE_LIMITED", message: "Too many new videos" } }]);
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fn, mock: false });
    const err = (await client.getSigns().catch((e: unknown) => e)) as ApiClientError;
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("rejects a response that doesn't match the schema", async () => {
    const { fn } = fakeFetch([{ body: [{ videoId: "x" }] }]);
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fn, mock: false });
    const err = (await client.discover("volcano").catch((e: unknown) => e)) as ApiClientError;
    expect(err.code).toBe("INVALID_RESPONSE");
  });
});

describe("mock mode", () => {
  it("returns the sample track without any network call", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      mock: true,
      fetch: (() => {
        throw new Error("should not fetch");
      }) as unknown as typeof fetch,
    });
    const t = await client.getSignTrack("my-video");
    expect(t.videoId).toBe("my-video");
    expect(t.segments.length).toBeGreaterThan(0);
    const signs = await client.getSigns();
    expect(signs).toContain("HELLO");
    expect(signs.some((g) => g.startsWith("FS:"))).toBe(false);
    expect((await client.discover("volcano"))[0]?.videoId).toBe("sample-volcanoes");
  });

  it("turns on with MOCK=1", async () => {
    const before = process.env.MOCK;
    process.env.MOCK = "1";
    try {
      const client = createApiClient({ baseUrl: "http://api.test" });
      expect((await client.health()).ok).toBe(true);
    } finally {
      process.env.MOCK = before;
    }
  });
});

describe("partial results", () => {
  it("calls onPartial only when new segments arrive", async () => {
    const seg = (start: number) => ({ start, end: start + 1, text: "x", signs: [] });
    const { fn } = fakeFetch([
      { body: track({ status: "processing", progress: 0.1 }) },
      { body: track({ status: "processing", progress: 0.5, segments: [seg(0)] }) },
      { body: track({ status: "processing", progress: 0.6, segments: [seg(0)] }) },
      { body: track({ status: "processing", progress: 0.8, segments: [seg(0), seg(1)] }) },
      { body: track({ status: "ready", segments: [seg(0), seg(1), seg(2)] }) },
    ]);
    const partials: number[] = [];
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fn, mock: false });
    const done = await client.getSignTrack("abc", "ASL", { pollIntervalMs: 1, onPartial: (t) => partials.push(t.segments.length) });
    expect(partials).toEqual([1, 2]);
    expect(done.segments).toHaveLength(3);
  });
});
