import { describe, expect, it } from "bun:test";
import { ruleGloss, spreadSigns, textToSigns } from "./index";

describe("placeholder gloss", () => {
  it("drops filler words, keeps dictionary words and fingerspells the rest", () => {
    expect(ruleGloss("The dog is big, Bob! [Music]", new Set(["DOG", "BIG"]))).toEqual(["DOG", "BIG", "FS:BOB"]);
  });

  it("spreads signs over the window without overlaps", () => {
    const signs = spreadSigns(["A", "B", "C"], 10, 13);
    expect(signs.map((s) => s.start)).toEqual([10, 11, 12]);
    for (let i = 1; i < signs.length; i++) {
      expect(signs[i]!.start).toBeGreaterThanOrEqual(signs[i - 1]!.start + signs[i - 1]!.duration - 1e-9);
    }
  });

  it("returns one segment per caption, and works without context", async () => {
    const segments = await textToSigns(
      [
        { start: 0, end: 2, text: "Hello my name is Bob" },
        { start: 2, end: 3, text: "[Applause]" },
      ],
      { lang: "ASL", dictionary: ["HELLO", "MY", "NAME"] },
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]!.signs.map((s) => s.gloss)).toEqual(["HELLO", "MY", "NAME", "FS:BOB"]);
    expect(segments[1]!.signs).toEqual([]);
  });
});
