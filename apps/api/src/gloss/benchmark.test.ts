import { expect, it } from "bun:test";
import { benchmarkVideo } from "./benchmark";
import type { VideoSource } from "../transcript";

const source = (durationSec: number): VideoSource => ({
  getDetails: async (videoId) => ({
    videoId,
    title: "Benchmark fixture",
    description: "",
    durationSec,
    isLive: false,
    playable: true,
    tracks: [{ url: "https://example.com/captions", languageCode: "en" }],
  }),
  getTrack: async () => ({
    events: [{ tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "Hello" }] }],
  }),
});
it("never accepts a fixture full-video benchmark as live provider evidence", async () => {
  const report = await benchmarkVideo("96M4q0OnMfY", ["HELLO"], false, {
    source: source(213),
  });
  expect(report.captionCount).toBe(1);
  expect(report.durationSeconds).toBe(213);
  expect(report.mode).toBe("fixture");
  expect(report.acceptance.status).toBe("blocked");
  expect(report.acceptance.criteria.providerOnly).toBe(false);
  expect(report.acceptance.criteria.fullVideoAtLeast3Minutes).toBe(true);
  expect(report.captionsAndGlossElapsedMs).toBeGreaterThanOrEqual(
    report.glossElapsedMs,
  );
});
it("does not substitute a short video or an excerpt for a full three-minute run", async () => {
  const report = await benchmarkVideo("TwsgCHYmbbA", [], false, {
    source: source(170),
  });
  expect(report.acceptance.criteria.fullVideoAtLeast3Minutes).toBe(false);
  await expect(
    benchmarkVideo("96M4q0OnMfY", [], false, { source: source(901) }),
  ).rejects.toThrow("15-minute");
});
