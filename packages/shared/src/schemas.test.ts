import { describe, expect, it } from "bun:test";
import sample from "../../../mocks/sign-track.sample.json";
import {
  CaptionSchema,
  SignTrackSchema,
  VideoContextSchema,
  videoContextJsonSchema,
} from "./schemas";

describe("SignTrackSchema", () => {
  it("parses the mock sign track", () => {
    const track = SignTrackSchema.parse(sample);
    expect(track.status).toBe("ready");
    expect(track.segments.length).toBeGreaterThan(10);
  });

  it("covers about 60 seconds with signs inside each caption window", () => {
    const track = SignTrackSchema.parse(sample);
    expect(track.segments.at(-1)?.end).toBeGreaterThanOrEqual(55);
    for (const seg of track.segments) {
      for (const sign of seg.signs) {
        expect(sign.start).toBeGreaterThanOrEqual(seg.start);
        expect(sign.start + sign.duration).toBeLessThanOrEqual(seg.end + 0.5);
      }
    }
  });

  it("rejects a track with no segments field", () => {
    const { segments: _segments, ...noSegments } = sample;
    expect(SignTrackSchema.safeParse(noSegments).success).toBe(false);
  });

  it("rejects an unknown sign language and an unknown error code", () => {
    expect(SignTrackSchema.safeParse({ ...sample, lang: "BSL" }).success).toBe(false);
    expect(SignTrackSchema.safeParse({ ...sample, status: "error", error: "OOPS" }).success).toBe(false);
  });
});

describe("CaptionSchema", () => {
  it("rejects a cue that ends before it starts", () => {
    expect(CaptionSchema.safeParse({ start: 5, end: 4, text: "x" }).success).toBe(false);
  });
});

describe("VideoContext JSON schema", () => {
  it("is an object schema with topic, names and terms", () => {
    expect(videoContextJsonSchema.type).toBe("object");
    expect(Object.keys(videoContextJsonSchema.properties ?? {})).toEqual(["topic", "names", "terms"]);
    expect(
      VideoContextSchema.safeParse({ topic: "Volcanoes", names: ["Mauna Loa"], terms: [{ term: "lava", meaning: "molten rock" }] }).success,
    ).toBe(true);
  });
});
