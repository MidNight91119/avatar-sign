import { describe, expect, it } from "bun:test";
import { createSqliteCache } from "./cache";
import { createJobManager } from "./jobs";
import { TranscriptError } from "./transcript";
import { VIDEO, fakeDeps } from "./test-helpers";

function setup(over: Parameters<typeof fakeDeps>[0] = {}) {
  const deps = fakeDeps(over);
  const logs: string[] = [];
  const cache = createSqliteCache(":memory:");
  const jobs = createJobManager({ cache, deps, log: (l) => logs.push(l) });
  return { deps, logs, cache, jobs };
}

describe("job manager", () => {
  it("starts one job for concurrent requests, reports processing, then serves the ready track", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { deps, jobs, logs } = setup({ gate });

    const a = jobs.lookup(VIDEO, "ASL")!;
    const b = jobs.lookup(VIDEO, "ASL")!;
    expect(a.started).toBe(true);
    expect(b.started).toBe(false);
    expect(a.track.status).toBe("processing");
    expect(a.track.progress).toBe(0);
    expect(jobs.runningCount()).toBe(1);

    release();
    const done = await jobs.wait(VIDEO, "ASL");
    expect(done?.status).toBe("ready");
    expect(deps.calls.transcript).toBe(1);
    expect(logs).toHaveLength(1);

    const cached = jobs.lookup(VIDEO, "ASL")!;
    expect(cached).toMatchObject({ cached: true, started: false });
    expect(cached.track.status).toBe("ready");
  });

  it("serves cached tracks without calling YouTube, Exa or the gloss again", async () => {
    const { deps, jobs } = setup();
    jobs.lookup(VIDEO, "ASL");
    await jobs.wait(VIDEO, "ASL");
    const before = { ...deps.calls };
    const t0 = performance.now();
    const hit = jobs.lookup(VIDEO, "ASL")!;
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(hit.cached).toBe(true);
    expect(deps.calls).toEqual(before);
  });

  it("keeps languages separate and rebuilds on refresh", async () => {
    const { deps, jobs } = setup();
    jobs.lookup(VIDEO, "ASL");
    await jobs.wait(VIDEO, "ASL");
    jobs.lookup(VIDEO, "ISL");
    await jobs.wait(VIDEO, "ISL");
    expect(deps.calls.transcript).toBe(2);
    const refreshed = jobs.lookup(VIDEO, "ASL", { refresh: true })!;
    expect(refreshed.started).toBe(true);
    await jobs.wait(VIDEO, "ASL");
    expect(deps.calls.transcript).toBe(3);
  });

  it("caches error tracks only for a short time", async () => {
    const { jobs, cache } = setup({
      getTranscript: async () => {
        throw new TranscriptError("NO_CAPTIONS", "none");
      },
    });
    jobs.lookup(VIDEO, "ASL");
    expect((await jobs.wait(VIDEO, "ASL"))?.error).toBe("NO_CAPTIONS");
    expect(cache.get(`track:${VIDEO}:ASL`)).toBeDefined();
    expect(jobs.lookup(VIDEO, "ASL")!.track.error).toBe("NO_CAPTIONS");
  });

  it("does not start a job when allowStart is false", () => {
    const { jobs, deps } = setup();
    expect(jobs.lookup(VIDEO, "ASL", { allowStart: false })).toBeUndefined();
    expect(deps.calls.transcript).toBe(0);
  });
});

describe("partial results", () => {
  it("exposes the segments glossed so far while the job is processing", async () => {
    let releaseSecond!: () => void;
    const secondBatch = new Promise<void>((r) => (releaseSecond = r));
    let batch = 0;
    const base = fakeDeps();
    const { jobs } = setup({
      batchSize: 2,
      textToSigns: async (captions, opts) => {
        if (batch++ === 1) await secondBatch;
        return base.textToSigns(captions, opts);
      },
    });
    jobs.lookup(VIDEO, "ASL");
    for (let i = 0; i < 20 && jobs.lookup(VIDEO, "ASL")!.track.segments.length === 0; i++) await Bun.sleep(1);
    const partial = jobs.lookup(VIDEO, "ASL")!.track;
    expect(partial.status).toBe("processing");
    expect(partial.segments).toHaveLength(2);
    expect(partial.progress).toBeGreaterThan(0.25);
    releaseSecond();
    expect((await jobs.wait(VIDEO, "ASL"))?.segments).toHaveLength(3);
  });
});
