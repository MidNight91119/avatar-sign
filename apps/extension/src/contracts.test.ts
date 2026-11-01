import { describe, expect, it } from "bun:test";
import { isSignTrack } from "./contracts";
import { describeError } from "./errors";
import { buildMockTrack } from "./mock-track";

describe("isSignTrack", () => {
  it("accepts a valid track", () => {
    expect(isSignTrack(buildMockTrack("dQw4w9WgXcQ", "ASL", 60))).toBe(true);
    expect(isSignTrack({ videoId: "x", lang: "ASL", status: "processing", progress: 0.4, segments: [] })).toBe(true);
  });

  it("rejects malformed tracks", () => {
    expect(isSignTrack(null)).toBe(false);
    expect(isSignTrack({ videoId: "x", lang: "ASL", status: "ready" })).toBe(false); // no segments
    expect(isSignTrack({ videoId: "x", lang: "BSL", status: "ready", segments: [] })).toBe(false);
    expect(isSignTrack({ videoId: "x", lang: "ASL", status: "done", segments: [] })).toBe(false);
    expect(
      isSignTrack({
        videoId: "x",
        lang: "ASL",
        status: "ready",
        segments: [{ start: 0, end: 1, text: "hi", signs: [{ gloss: "HELLO", start: "0" }] }],
      }),
    ).toBe(false);
  });
});

describe("buildMockTrack", () => {
  const track = buildMockTrack("dQw4w9WgXcQ", "ASL", 120);

  it("is a ready track for the requested video", () => {
    expect(track.videoId).toBe("dQw4w9WgXcQ");
    expect(track.status).toBe("ready");
    expect(track.segments.length).toBeGreaterThan(20);
  });

  it("keeps every sign inside its segment, in order", () => {
    for (const segment of track.segments) {
      let previousEnd = segment.start;
      for (const sign of segment.signs) {
        expect(sign.start).toBeGreaterThanOrEqual(previousEnd);
        expect(sign.start + sign.duration).toBeLessThanOrEqual(segment.end);
        previousEnd = sign.start + sign.duration;
      }
    }
  });

  it("includes fingerspelling", () => {
    expect(track.segments.some((s) => s.signs.some((sign) => sign.gloss.startsWith("FS:")))).toBe(true);
  });
});

describe("describeError", () => {
  it("gives the spec's message for videos without captions", () => {
    expect(describeError("NO_CAPTIONS")).toBe("No captions available for this video");
  });
  it("falls back to a generic message", () => {
    expect(describeError("SOMETHING_NEW")).toBe("Couldn't prepare signs for this video");
    expect(describeError(undefined)).toBe("Couldn't prepare signs for this video");
  });
});
