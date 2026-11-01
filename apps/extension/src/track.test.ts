import { describe, expect, it } from "bun:test";
import type { SignTrack } from "@signstream/shared";
import { createSignIndex, formatGloss } from "./track";

const track: Pick<SignTrack, "segments"> = {
  // Deliberately out of order: the index must sort.
  segments: [
    {
      start: 10,
      end: 12,
      text: "Thank you.",
      signs: [{ gloss: "THANK-YOU", start: 10.2, duration: 1 }],
    },
    {
      start: 1,
      end: 4,
      text: "Hello, my name is Bob.",
      signs: [
        { gloss: "HELLO", start: 1, duration: 0.5 },
        { gloss: "MY", start: 1.6, duration: 0.4 },
        { gloss: "FS:BOB", start: 2.2, duration: 1.2 },
      ],
    },
  ],
};

describe("createSignIndex", () => {
  const index = createSignIndex(track);

  it("finds the sign playing at a time", () => {
    expect(index.signAt(1)?.gloss).toBe("HELLO");
    expect(index.signAt(1.7)?.gloss).toBe("MY");
    expect(index.signAt(3)?.gloss).toBe("FS:BOB");
    expect(index.signAt(10.5)?.gloss).toBe("THANK-YOU");
  });

  it("returns nothing between signs, before the first and after the last", () => {
    expect(index.signAt(0)).toBeUndefined();
    expect(index.signAt(1.55)).toBeUndefined();
    expect(index.signAt(5)).toBeUndefined();
    expect(index.signAt(99)).toBeUndefined();
  });

  it("works when time jumps backwards (seeking)", () => {
    expect(index.signAt(10.5)?.gloss).toBe("THANK-YOU");
    expect(index.signAt(1.2)?.gloss).toBe("HELLO");
  });

  it("finds the caption segment", () => {
    expect(index.segmentAt(2)?.text).toBe("Hello, my name is Bob.");
    expect(index.segmentAt(6)).toBeUndefined();
    expect(index.segmentAt(11)?.text).toBe("Thank you.");
  });

  it("handles an empty track", () => {
    const empty = createSignIndex({ segments: [] });
    expect(empty.signAt(1)).toBeUndefined();
    expect(empty.segmentAt(1)).toBeUndefined();
  });
});

describe("formatGloss", () => {
  it("spells out fingerspelled words", () => {
    expect(formatGloss("FS:BOB")).toBe("B-O-B");
  });
  it("leaves other glosses alone", () => {
    expect(formatGloss("STORE")).toBe("STORE");
    expect(formatGloss("THANK-YOU")).toBe("THANK-YOU");
  });
});
