import { describe, expect, it } from "bun:test";
import { cerebrasBudgetDefaults, createRequestBudget, rateLimitInfo } from "./provider-budget";

/** A fake clock: timers fire only when the test advances time. */
function fakeClock() {
  let t = 0;
  const timers: { at: number; fn: () => void }[] = [];
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => timers.push({ at: t + ms, fn }),
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
        await flush();
      }
      t = end;
      await flush();
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("createRequestBudget", () => {
  it("keeps simultaneous videos under one per-minute limit", async () => {
    const clock = fakeClock();
    const budget = createRequestBudget({ perMinute: 5, concurrency: 10, now: clock.now, setTimer: clock.setTimer });
    const startedAt: number[] = [];
    const call = () => budget.run(async () => void startedAt.push(clock.now()));
    // Three "videos" with 4 requests each, all at once.
    const all = Promise.all(Array.from({ length: 12 }, call));
    await flush();
    expect(startedAt).toHaveLength(5);
    await clock.advance(60_000);
    expect(startedAt).toHaveLength(10);
    await clock.advance(60_000);
    await all;
    expect(startedAt).toEqual([0, 0, 0, 0, 0, 60_000, 60_000, 60_000, 60_000, 60_000, 120_000, 120_000]);
    expect(budget.stats().peakPerMinute).toBe(5);
  });

  it("also enforces an hourly cap", async () => {
    const clock = fakeClock();
    const budget = createRequestBudget({ perMinute: 2, perHour: 3, concurrency: 5, now: clock.now, setTimer: clock.setTimer });
    const startedAt: number[] = [];
    const all = Promise.all(Array.from({ length: 4 }, () => budget.run(async () => void startedAt.push(clock.now()))));
    await clock.advance(60_000);
    expect(startedAt).toEqual([0, 0, 60_000]); // minute cap opens one more; the hour cap holds the 4th
    await clock.advance(60 * 60_000);
    await all;
    expect(startedAt).toEqual([0, 0, 60_000, 3_600_000]);
  });

  it("keeps the token window under its cap, using real usage once a call returns", async () => {
    const clock = fakeClock();
    const budget = createRequestBudget({ perMinute: 100, tokensPerMinute: 10_000, concurrency: 5, now: clock.now, setTimer: clock.setTimer });
    const startedAt: number[] = [];
    // Each call is estimated at 4k tokens; the model reports 3k.
    const call = () =>
      budget.run(async () => (startedAt.push(clock.now()), { usage: 3000 }), { tokens: 4000, actual: (r) => r.usage });
    const all = Promise.all(Array.from({ length: 4 }, call));
    await flush();
    // 2 calls start (8k estimated); after they return they count 3k each = 6k, so a 3rd fits (10k).
    expect(startedAt).toEqual([0, 0, 0]);
    await clock.advance(60_000);
    await all;
    expect(startedAt).toEqual([0, 0, 0, 60_000]);
    expect(budget.stats().peakTokensPerMinute).toBeLessThanOrEqual(10_000);
  });

  it("lets one oversized call run alone instead of waiting forever", async () => {
    const budget = createRequestBudget({ perMinute: 100, tokensPerMinute: 1000, concurrency: 1 });
    expect(await budget.run(async () => "ok", { tokens: 5000 })).toBe("ok");
  });

  it("caps requests in flight across callers", async () => {
    const budget = createRequestBudget({ perMinute: 1000, concurrency: 2 });
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        budget.run(async () => {
          peak = Math.max(peak, ++active);
          await new Promise((r) => setTimeout(r, 2));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(budget.stats()).toMatchObject({ started: 8, inFlight: 0, queued: 0, peakConcurrency: 2 });
  });

  it("counts retries against the same budget and pauses everyone after a 429", async () => {
    const clock = fakeClock();
    const budget = createRequestBudget({ perMinute: 100, concurrency: 4, backoffMs: 1000, now: clock.now, setTimer: clock.setTimer });
    const startedAt: number[] = [];
    const limited = Object.assign(new Error("rate limited"), { status: 429, headers: { "retry-after": "3" } });
    const first = budget.run(async () => {
      startedAt.push(clock.now());
      throw limited;
    });
    await expect(first).rejects.toBe(limited);
    // A retry from that video and a request from another video both wait for Retry-After.
    const retry = budget.run(async () => void startedAt.push(clock.now()));
    const other = budget.run(async () => void startedAt.push(clock.now()));
    await clock.advance(2999);
    expect(startedAt).toEqual([0]);
    await clock.advance(1);
    await Promise.all([retry, other]);
    expect(startedAt).toEqual([0, 3000, 3000]);
    expect(budget.stats().rateLimited).toBe(1);
  });

  it("passes results and non-429 errors through unchanged", async () => {
    const budget = createRequestBudget({ perMinute: 10, concurrency: 1 });
    expect(await budget.run(async () => 42)).toBe(42);
    const boom = new Error("boom");
    await expect(budget.run(async () => Promise.reject(boom))).rejects.toBe(boom);
    expect(budget.stats().rateLimited).toBe(0);
  });
});

describe("rateLimitInfo", () => {
  it("reads 429 and Retry-After from SDK-style and fetch-style errors", () => {
    expect(rateLimitInfo({ status: 429, headers: { "retry-after": "2" } })).toEqual({ limited: true, retryAfterMs: 2000 });
    expect(rateLimitInfo({ status: 429, headers: new Headers({ "retry-after": "1" }) })).toEqual({ limited: true, retryAfterMs: 1000 });
    expect(rateLimitInfo({ status: 429 })).toEqual({ limited: true, retryAfterMs: undefined });
    expect(rateLimitInfo({ status: 500 })).toEqual({ limited: false });
    expect(rateLimitInfo("nope")).toEqual({ limited: false });
  });
});

describe("cerebrasBudgetDefaults", () => {
  it("paces free accounts at the observed 5 requests/min, one at a time", () => {
    expect(cerebrasBudgetDefaults("free")).toEqual({ perMinute: 5, perHour: 150, tokensPerMinute: 30_000, concurrency: 1 });
    expect(cerebrasBudgetDefaults(undefined)).toEqual({ perMinute: 60, concurrency: 4 });
  });
});
