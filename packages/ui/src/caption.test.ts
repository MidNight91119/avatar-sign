import { describe, expect, test } from "bun:test";
import { SignTrackSchema } from "@signstream/shared";
import sample from "../../../mocks/sign-track.sample.json";
import { captionAt, splitAtGloss } from "./caption";

const track = SignTrackSchema.parse(sample);

describe("captionAt", () => {
  test("picks the right caption and sign at three times", () => {
    expect(captionAt(track, 0.1)).toMatchObject({ text: "Hello everyone, my name is Bob.", gloss: "HELLO" });
    expect(captionAt(track, 2.5)).toMatchObject({ gloss: "FS:BOB", signStart: 2.0 });
    expect(captionAt(track, 5.5)).toMatchObject({
      prev: "Hello everyone, my name is Bob.",
      text: "Today we are going to learn about volcanoes.",
      gloss: "FS:VOLCANO",
    });
  });

  test("seeking backwards gives the same answer as playing forwards", () => {
    const forward = captionAt(track, 9.2);
    captionAt(track, 40);
    expect(captionAt(track, 9.2)).toEqual(forward);
  });

  test("a sign ends at start + duration (half-open interval)", () => {
    expect(captionAt(track, 0.6).gloss).toBe("ALL");
    expect(captionAt(track, 0.599).gloss).toBe("HELLO");
  });

  test("before the first and after the last caption there is no sign", () => {
    const late = { ...track, segments: track.segments.map((s) => ({ ...s, start: s.start + 5, end: s.end + 5 })) };
    expect(captionAt(late, 1)).toEqual({ progress: 1 / 65 });
    expect(captionAt(track, 61)).toEqual({ prev: "Thank you for watching. Bye!", progress: 1 });
  });

  test("no track yet → empty state", () => {
    expect(captionAt(undefined, 3)).toEqual({ progress: 0 });
  });
});

describe("splitAtGloss", () => {
  test("highlights the English word a sign stands for", () => {
    expect(splitAtGloss("Today we are going to learn about volcanoes.", "FS:VOLCANO")).toEqual([
      "Today we are going to learn about ",
      "volcanoes",
      ".",
    ]);
    expect(splitAtGloss("Thank you for watching. Bye!", "THANK-YOU")).toEqual(["", "Thank you", " for watching. Bye!"]);
  });

  test("does not match inside other words", () => {
    expect(splitAtGloss("They were here.", "WE")).toEqual(["They were here.", "", ""]);
  });

  test("no gloss or no match → whole text", () => {
    expect(splitAtGloss("Hello everyone", undefined)).toEqual(["Hello everyone", "", ""]);
    expect(splitAtGloss("Hello everyone", "ALL")).toEqual(["Hello everyone", "", ""]);
    expect(splitAtGloss("a.b", "(.*)")).toEqual(["a.b", "", ""]);
  });
});
