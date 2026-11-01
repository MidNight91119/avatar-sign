import { describe, expect, it } from "bun:test";
import type { DiscoverResult, SignReference } from "@signstream/shared";
import { createApp, isAllowedOrigin, type AppServices } from "./app";
import { createSqliteCache } from "./cache";
import { loadEnv } from "./env";
import { createJobManager } from "./jobs";
import { createRateLimiter } from "./rate-limit";
import { VIDEO, fakeDeps } from "./test-helpers";

const SECRETS = { CEREBRAS_API_KEY: "csk-live-secret-1", EXA_API_KEY: "exa-live-secret-2", ADMIN_SECRET: "admin-secret-3" };

function setup(over: Partial<AppServices> = {}, envOver: Record<string, string> = {}) {
  const env = loadEnv({ ...SECRETS, ...envOver });
  const cache = createSqliteCache(":memory:");
  const deps = fakeDeps();
  const logs: string[] = [];
  const jobs = createJobManager({ cache, deps, log: (l) => logs.push(l) });
  const calls = { discover: 0, signReference: 0 };
  const services: AppServices = {
    env,
    cache,
    jobs,
    dictionary: (lang) => (lang === "ASL" ? ["HELLO", "NAME"] : []),
    discover: async (q): Promise<DiscoverResult[]> => {
      calls.discover++;
      return [{ videoId: "aaaaaaaaaaa", title: q, url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", snippet: "", thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg" }];
    },
    signReference: async (word): Promise<SignReference[]> => {
      calls.signReference++;
      return [{ title: word, url: "https://www.handspeak.com/word/x/", source: "handspeak.com" }];
    },
    log: (l) => logs.push(l),
    ...over,
  };
  const app = createApp(services);
  const get = (path: string, headers: Record<string, string> = {}) => app.request(path, { headers: { "x-forwarded-for": "1.2.3.4", ...headers } });
  return { app, get, jobs, deps, calls, logs };
}

describe("GET /api/health", () => {
  it("reports which sponsor keys are configured, never the keys", async () => {
    const { get } = setup();
    const res = await get("/api/health");
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: true, cerebras: true, exa: true });
    for (const s of Object.values(SECRETS)) expect(text).not.toContain(s);
  });
});

describe("GET /api/sign-track", () => {
  it("returns processing with progress, then the ready track; concurrent requests start one job", async () => {
    const { get, jobs, deps } = setup();
    const [a, b] = await Promise.all([get(`/api/sign-track?videoId=${VIDEO}`), get(`/api/sign-track?videoId=${VIDEO}&lang=ASL`)]);
    const first = await a.json();
    expect(first.status).toBe("processing");
    expect(typeof first.progress).toBe("number");
    expect((await b.json()).status).toBe("processing");
    await jobs.wait(VIDEO, "ASL");
    expect(deps.calls.transcript).toBe(1);
    const ready = await (await get(`/api/sign-track?videoId=${VIDEO}`)).json();
    expect(ready.status).toBe("ready");
    expect(ready.segments.length).toBe(3);
  });

  it("validates videoId and lang", async () => {
    const { get } = setup();
    expect((await get("/api/sign-track?videoId=bad")).status).toBe(400);
    expect((await get(`/api/sign-track?videoId=${VIDEO}&lang=BSL`)).status).toBe(400);
  });

  it("rate-limits new videos per IP with 429, but not cached ones", async () => {
    const { get, jobs } = setup({ limits: { newVideos: createRateLimiter(1, 60_000) } });
    expect((await get(`/api/sign-track?videoId=${VIDEO}`)).status).toBe(200);
    await jobs.wait(VIDEO, "ASL");
    const other = await get("/api/sign-track?videoId=bbbbbbbbbbb");
    expect(other.status).toBe(429);
    expect((await other.json()).error).toBe("RATE_LIMITED");
    expect((await get(`/api/sign-track?videoId=${VIDEO}`)).status).toBe(200);
    expect((await get("/api/sign-track?videoId=bbbbbbbbbbb", { "x-forwarded-for": "5.6.7.8" })).status).toBe(200);
  });

  it("only rebuilds with ?refresh=1 when the admin secret is sent", async () => {
    const { get, jobs, deps } = setup();
    await get(`/api/sign-track?videoId=${VIDEO}`);
    await jobs.wait(VIDEO, "ASL");
    expect((await get(`/api/sign-track?videoId=${VIDEO}&refresh=1`)).status).toBe(403);
    const res = await get(`/api/sign-track?videoId=${VIDEO}&refresh=1`, { "x-admin-secret": SECRETS.ADMIN_SECRET });
    expect((await res.json()).status).toBe("processing");
    await jobs.wait(VIDEO, "ASL");
    expect(deps.calls.transcript).toBe(2);
  });
});

describe("GET /api/sign-track/:videoId/vtt", () => {
  it("exports a ready track as WebVTT", async () => {
    const { get, jobs } = setup();
    await get(`/api/sign-track?videoId=${VIDEO}`);
    await jobs.wait(VIDEO, "ASL");
    const res = await get(`/api/sign-track/${VIDEO}/vtt`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/vtt");
    const body = await res.text();
    expect(body.startsWith("WEBVTT\n")).toBe(true);
    expect(body).toContain("00:00:00.000 --> 00:00:02.000\nHELLO MY NAME fs-IS fs-BOB");
  });

  it("never starts a job: 404 for unknown videos, 409 while processing", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const deps = fakeDeps({ gate });
    const jobs = createJobManager({ cache: createSqliteCache(":memory:"), deps, log: () => {} });
    const { get } = setup({ jobs });
    const missing = await get(`/api/sign-track/${VIDEO}/vtt`);
    expect(missing.status).toBe(404);
    expect(deps.calls.transcript).toBe(0);
    await get(`/api/sign-track?videoId=${VIDEO}`);
    expect((await get(`/api/sign-track/${VIDEO}/vtt`)).status).toBe(409);
    release();
    await jobs.wait(VIDEO, "ASL");
    expect((await get(`/api/sign-track/${VIDEO}/vtt`)).status).toBe(200);
  });

  it("validates videoId and lang", async () => {
    const { get } = setup();
    expect((await get("/api/sign-track/short/vtt")).status).toBe(400);
    expect((await get(`/api/sign-track/${VIDEO}/vtt?lang=BSL`)).status).toBe(400);
  });
});

describe("POST /api/captions/:videoId", () => {
  const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello my name is Bob\n\n00:00:02.000 --> 00:00:04.000\nToday we learn\n";

  it("needs the admin secret", async () => {
    const { app } = setup();
    expect((await app.request(`/api/captions/${VIDEO}`, { method: "POST", body: vtt })).status).toBe(403);
  });

  it("glosses an uploaded .vtt as a manual track (raw body or form upload)", async () => {
    const { app, jobs } = setup();
    const res = await app.request(`/api/captions/${VIDEO}`, { method: "POST", body: vtt, headers: { "x-admin-secret": SECRETS.ADMIN_SECRET, "content-type": "text/vtt" } });
    expect(res.status).toBe(202);
    expect((await res.json()).source).toBe("manual");
    const track = await jobs.wait(VIDEO, "ASL");
    expect(track?.status).toBe("ready");
    expect(track?.source).toBe("manual");

    const form = new FormData();
    form.set("file", new File([vtt], "captions.vtt", { type: "text/vtt" }));
    const res2 = await app.request(`/api/captions/${VIDEO}`, { method: "POST", body: form, headers: { "x-admin-secret": SECRETS.ADMIN_SECRET } });
    expect(res2.status).toBe(202);
  });

  it("rejects files that aren't WebVTT", async () => {
    const { app } = setup();
    const res = await app.request(`/api/captions/${VIDEO}`, { method: "POST", body: "hello", headers: { "x-admin-secret": SECRETS.ADMIN_SECRET } });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/signs", () => {
  it("returns the dictionary for the language", async () => {
    const { get } = setup();
    expect(await (await get("/api/signs")).json()).toEqual(["HELLO", "NAME"]);
    expect(await (await get("/api/signs?lang=ISL")).json()).toEqual([]);
  });
});

describe("GET /api/discover", () => {
  it("validates q, caches results and rate-limits only uncached searches", async () => {
    const { get, calls } = setup({ limits: { discover: createRateLimiter(1, 60_000) } });
    expect((await get("/api/discover?q=a")).status).toBe(400);
    expect((await (await get("/api/discover?q=volcanoes")).json())[0].videoId).toBe("aaaaaaaaaaa");
    expect((await get("/api/discover?q=Volcanoes")).status).toBe(200);
    expect(calls.discover).toBe(1);
    expect((await get("/api/discover?q=lava")).status).toBe(429);
  });

  it("answers 503 without Exa and 502 when Exa fails", async () => {
    expect((await setup({ discover: undefined }).get("/api/discover?q=volcanoes")).status).toBe(503);
    const failing = setup({
      discover: async () => {
        throw new Error("exa down");
      },
    });
    expect((await failing.get("/api/discover?q=volcanoes")).status).toBe(502);
  });
});

describe("GET /api/sign-reference", () => {
  it("validates the word and caches forever", async () => {
    const { get, calls } = setup();
    expect((await get("/api/sign-reference?word=<script>")).status).toBe(400);
    expect((await (await get("/api/sign-reference?word=volcano")).json())[0].source).toBe("handspeak.com");
    await get("/api/sign-reference?word=Volcano");
    expect(calls.signReference).toBe(1);
  });
});

describe("Exa hardening (R-I8)", () => {
  it("answers 504 with a friendly message when Exa hangs", async () => {
    const { get } = setup({ exaTimeoutMs: 20, discover: () => new Promise(() => {}) });
    const res = await get("/api/discover?q=volcanoes");
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: "UPSTREAM_TIMEOUT", message: "Search took too long; try again" });
  });

  it("answers 503 with Retry-After when Exa rate-limits us", async () => {
    const { get } = setup({ signReference: async () => Promise.reject(Object.assign(new Error("too many"), { status: 429 })) });
    const res = await get("/api/sign-reference?word=volcano");
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await res.json()).error).toBe("UPSTREAM_BUSY");
  });

  it("shares one paid call between identical requests that arrive together", async () => {
    let calls = 0;
    let release!: (r: DiscoverResult[]) => void;
    const { get } = setup({
      discover: () => {
        calls++;
        return new Promise((r) => (release = r));
      },
    });
    const both = Promise.all([get("/api/discover?q=lava"), get("/api/discover?q=Lava")]);
    await new Promise((r) => setTimeout(r, 5));
    release([]);
    const [a, b] = await both;
    expect(calls).toBe(1);
    expect(await a.json()).toEqual([]);
    expect(await b.json()).toEqual([]);
  });

  it("caches empty answers for 5 minutes only", async () => {
    let t = 0;
    let calls = 0;
    const { get } = setup({ cache: createSqliteCache(":memory:", () => t), signReference: async () => (calls++, []) });
    await get("/api/sign-reference?word=zzz");
    t = 4 * 60_000;
    await get("/api/sign-reference?word=zzz");
    expect(calls).toBe(1);
    t = 6 * 60_000;
    await get("/api/sign-reference?word=zzz");
    expect(calls).toBe(2);
  });

  it("does not cache failures", async () => {
    let calls = 0;
    const { get } = setup({ discover: async () => (calls++, Promise.reject(new Error("down"))) });
    await get("/api/discover?q=lava");
    await get("/api/discover?q=lava");
    expect(calls).toBe(2);
  });
});

describe("CORS", () => {
  it("allows YouTube, extensions, localhost and configured origins only", () => {
    expect(isAllowedOrigin("https://www.youtube.com", [])).toBe(true);
    expect(isAllowedOrigin(`chrome-extension://${"a".repeat(32)}`, [])).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", [])).toBe(true);
    expect(isAllowedOrigin("https://signstream.vercel.app", ["https://signstream.vercel.app"])).toBe(true);
    expect(isAllowedOrigin("https://evil.example", [])).toBe(false);
    expect(isAllowedOrigin("http://localhost.evil.example", [])).toBe(false);
  });

  it("sends the allow-origin header only for allowed origins", async () => {
    const { get } = setup();
    expect((await get("/api/health", { origin: "https://www.youtube.com" })).headers.get("access-control-allow-origin")).toBe("https://www.youtube.com");
    expect((await get("/api/health", { origin: "https://evil.example" })).headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("secrets", () => {
  it("never appear in any response body or log line", async () => {
    const { get, jobs, logs } = setup();
    const bodies: string[] = [];
    for (const path of [`/api/sign-track?videoId=${VIDEO}`, "/api/signs", "/api/discover?q=volcanoes", "/api/sign-reference?word=lava", "/api/nope"]) {
      bodies.push(await (await get(path)).text());
    }
    await jobs.wait(VIDEO, "ASL");
    bodies.push(await (await get(`/api/sign-track?videoId=${VIDEO}`)).text());
    const all = [...bodies, ...logs].join("\n");
    for (const s of Object.values(SECRETS)) expect(all).not.toContain(s);
  });
});
