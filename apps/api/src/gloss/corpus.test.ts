import { describe, expect, it } from "bun:test";
import { evaluateCorpus } from "./corpus";
import type { GlossRequest } from "./index";
import { fileURLToPath } from "node:url";

const corpus = {
  source: "fixture",
  videos: Array.from({ length: 5 }, (_, i) => ({
    videoId: `fixture-${i + 1}`,
    captions: [{ start: 0, end: 180, text: "Hello Bob" }],
  })),
};
const complete = async (request: GlossRequest) => ({
  choices: [
    {
      message: {
        content: JSON.stringify({
          segments: (
            JSON.parse(request.messages[1]!.content).segments as {
              index: number;
            }[]
          ).map(({ index }) => ({ index, tokens: ["HELLO", "FS:BOB"] })),
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
});

describe("demo corpus evaluation", () => {
  it("ranks five videos independently and keeps fixture/offline runs blocked", async () => {
    const report = await evaluateCorpus(corpus, [], { live: false });
    expect(report.videos).toHaveLength(5);
    expect(report.acceptance.status).toBe("blocked");
    expect(report.coveragePercent).toBe(0);
    expect(report.missing.find(({ word }) => word === "BOB")?.count).toBe(5);
    expect(
      report.priorities.find(({ word }) => word === "HELLO")?.captionCount,
    ).toBe(5);
    expect(
      report.videos.every(({ providerCalls }) => providerCalls === 0),
    ).toBe(true);
  });
  it("does not treat mocked provider output as live evidence", async () => {
    const report = await evaluateCorpus(
      corpus,
      ["HELLO"],
      { live: true },
      { complete },
    );
    expect(report.mode).toBe("mock");
    expect(report.acceptance.status).toBe("blocked");
    expect(report.coveragePercent).toBe(50);
    expect(
      report.videos.every(
        ({ providerCalls, fallbackBatches }) =>
          providerCalls === 1 && fallbackBatches === 0,
      ),
    ).toBe(true);
    expect(report.acceptance.criteria.providerOnly).toBe(false);
    expect(report.acceptance.criteria.threeMinuteUnder10Seconds).toBe(false);
  });
  it("never passes speed or coverage gates from provider fallback", async () => {
    const report = await evaluateCorpus(
      { ...corpus, source: "manual" },
      ["HELLO", "BOB"],
      { live: true },
      {
        complete: async () => {
          throw new Error("Provider unavailable");
        },
      },
    );
    expect(report.coveragePercent).toBe(100);
    expect(
      report.videos.every(({ fallbackBatches }) => fallbackBatches === 1),
    ).toBe(true);
    expect(report.acceptance.criteria.providerOnly).toBe(false);
    expect(report.acceptance.status).not.toBe("passed");
  });
  it("reports sub-minimum sign durations instead of passing dense tracks", async () => {
    const dense = {
      source: "fixture",
      videos: [
        {
          videoId: "dense",
          captions: [{ start: 0, end: 0.1, text: "dog dog dog" }],
        },
      ],
    };
    const report = await evaluateCorpus(dense, ["DOG"], { live: false });
    expect(report.videos[0]?.tooFastSigns).toBe(3);
    expect(report.acceptance.criteria.timing).toBe(false);
    expect(report.acceptance.criteria.fiveVideos).toBe(false);
  });
  it("validates the entire corpus before making a provider request", async () => {
    let calls = 0;
    const dependencies = {
      complete: async (request: GlossRequest) => {
        calls++;
        return complete(request);
      },
    };
    await expect(
      evaluateCorpus(
        { ...corpus, videos: [corpus.videos[0], corpus.videos[0]] },
        [],
        { live: true },
        dependencies,
      ),
    ).rejects.toThrow();
    await expect(
      evaluateCorpus(
        {
          source: "fixture",
          videos: [
            { videoId: "bad", captions: [{ start: 2, end: 1, text: "Hello" }] },
          ],
        },
        [],
        { live: true },
        dependencies,
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it("runs the corpus CLI and makes --check fail on fixture-only evidence", () => {
    const command = [
      globalThis.process.execPath,
      fileURLToPath(new URL("./eval.ts", import.meta.url)),
      "--corpus",
      fileURLToPath(new URL("./fixtures/corpus.sample.json", import.meta.url)),
    ];
    const report = globalThis.Bun.spawnSync(command, {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(report.exitCode).toBe(0);
    expect(JSON.parse(report.stdout.toString()).acceptance.status).toBe(
      "blocked",
    );
    const checked = globalThis.Bun.spawnSync([...command, "--check"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(checked.exitCode).toBe(1);
    expect(
      JSON.parse(checked.stdout.toString()).acceptance.criteria.realData,
    ).toBe(false);
  });
});
