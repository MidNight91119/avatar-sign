import { describe, expect, it } from "bun:test";
import { buildSignTrack, formatMetrics } from "./pipeline";
import { TranscriptError } from "./transcript";
import { VIDEO, fakeDeps, transcript } from "./test-helpers";

describe("buildSignTrack", () => {
  it("builds a ready track, batches gloss calls and reports rising progress", async () => {
    const deps = fakeDeps();
    const progress: number[] = [];
    const { track, metrics } = await buildSignTrack(VIDEO, "ASL", deps, (p) => progress.push(p));
    expect(track.status).toBe("ready");
    expect(track.segments).toHaveLength(3);
    expect(deps.calls.gloss).toBe(2); // 3 captions, batches of 2
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(deps.contexts[0]?.topic).toBe("Volcanoes");
    expect(metrics.captions).toBe(3);
    expect(metrics.signs).toBeGreaterThan(0);
    expect(metrics.fingerspelled).toBeGreaterThan(0);
    expect(metrics.context).toBe(true);
  });

  it("still finishes when Exa gives no context", async () => {
    const deps = fakeDeps({ getContext: async () => undefined });
    const { track, metrics } = await buildSignTrack(VIDEO, "ASL", deps);
    expect(track.status).toBe("ready");
    expect(deps.contexts.every((c) => c === undefined)).toBe(true);
    expect(metrics.context).toBe(false);
  });

  it("turns transcript errors into error tracks with the same code", async () => {
    const deps = fakeDeps({
      getTranscript: async () => {
        throw new TranscriptError("NO_CAPTIONS", "none");
      },
    });
    const { track } = await buildSignTrack(VIDEO, "ASL", deps);
    expect(track).toMatchObject({ status: "error", error: "NO_CAPTIONS", segments: [] });
  });

  it("refuses videos over the length limit without calling Exa or the gloss", async () => {
    const deps = fakeDeps({ getTranscript: async () => transcript({ durationSec: 3600 }) });
    const { track } = await buildSignTrack(VIDEO, "ASL", deps);
    expect(track.error).toBe("VIDEO_TOO_LONG");
    expect(deps.calls.context).toBe(0);
    expect(deps.calls.gloss).toBe(0);
  });

  it("reports GLOSS_FAILED when the gloss throws, and INTERNAL for unknown errors", async () => {
    const failingGloss = fakeDeps({
      textToSigns: async () => {
        throw new Error("Cerebras 500");
      },
    });
    expect((await buildSignTrack(VIDEO, "ASL", failingGloss)).track.error).toBe("GLOSS_FAILED");
    const broken = fakeDeps({
      getTranscript: async () => {
        throw new Error("boom");
      },
    });
    expect((await buildSignTrack(VIDEO, "ASL", broken)).track.error).toBe("INTERNAL");
  });

  it("formats one log line without caption text", async () => {
    const { metrics } = await buildSignTrack(VIDEO, "ASL", fakeDeps());
    const line = formatMetrics(metrics);
    expect(line).toStartWith(`job ${VIDEO}:ASL status=ready captions=3`);
    expect(line).toContain("context=yes");
    expect(line).not.toContain("volcanoes");
  });
});
