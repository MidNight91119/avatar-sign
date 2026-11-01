import { describe, expect, it } from "bun:test";
import { cleanCaptionText, decodeEntities, normalizeCaptions, parseJson3, parseVtt } from "./captions";

const isSortedNonOverlapping = (cues: { start: number; end: number }[]) =>
  cues.every((c, i) => c.end >= c.start && (i === 0 || c.start >= cues[i - 1]!.end - 1e-9));

describe("text cleanup", () => {
  it("decodes HTML entities", () => {
    expect(decodeEntities("Tom &amp; Jerry &#39;n&#x27; &quot;friends&quot;")).toBe(`Tom & Jerry 'n' "friends"`);
  });
  it("removes [Music]-style tags, speaker arrows and markup", () => {
    expect(cleanCaptionText(">> [Music] Hello <c>world</c> (applause) ♪")).toBe("Hello world");
  });
});

describe("parseJson3", () => {
  it("reads events with text and skips empty ones", () => {
    const cues = parseJson3({
      events: [
        { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "Hello " }, { utf8: "there" }] },
        { tStartMs: 1500, dDurationMs: 500, segs: [{ utf8: "\n" }] },
        { tStartMs: 2000, dDurationMs: 1000 },
      ],
    });
    expect(cues).toEqual([{ start: 0, end: 1.5, text: "Hello there" }]);
  });
  it("returns [] for unexpected input", () => {
    expect(parseJson3({})).toEqual([]);
    expect(parseJson3(null)).toEqual([]);
  });
});

describe("parseVtt", () => {
  const vtt = `WEBVTT
Kind: captions

NOTE this is ignored

1
00:00:01.000 --> 00:00:03.500 align:start position:0%
Hello everyone,
my name is Bob.

00:00:04.000 --> 00:00:06.000
Today we learn about volcanoes.
`;
  it("parses cues, multi-line text and cue settings", () => {
    expect(parseVtt(vtt)).toEqual([
      { start: 1, end: 3.5, text: "Hello everyone, my name is Bob." },
      { start: 4, end: 6, text: "Today we learn about volcanoes." },
    ]);
  });
  it("supports mm:ss timestamps and CRLF", () => {
    expect(parseVtt("WEBVTT\r\n\r\n01:02.500 --> 01:04.000\r\nHi\r\n")).toEqual([{ start: 62.5, end: 64, text: "Hi" }]);
  });
  it("rejects files without the WEBVTT header", () => {
    expect(() => parseVtt("1\n00:00:01.000 --> 00:00:02.000\nHi")).toThrow(/WEBVTT/);
  });
});

describe("normalizeCaptions", () => {
  it("sorts, removes overlaps from rolling auto-captions and drops empty cues", () => {
    const out = normalizeCaptions([
      { start: 4, end: 9, text: "the second line" },
      { start: 0, end: 5, text: "the first line here" },
      { start: 9, end: 10, text: "[Music]" },
    ]);
    expect(out.map((c) => c.text)).toEqual(["the first line here", "the second line"]);
    expect(isSortedNonOverlapping(out)).toBe(true);
    expect(out[0]!.end).toBe(4);
  });

  it("merges cues shorter than 1s into the next one", () => {
    const out = normalizeCaptions([
      { start: 0, end: 0.4, text: "So," },
      { start: 0.4, end: 2.5, text: "let's begin." },
      { start: 5, end: 7, text: "Next part." },
    ]);
    expect(out).toEqual([
      { start: 0, end: 2.5, text: "So, let's begin." },
      { start: 5, end: 7, text: "Next part." },
    ]);
  });

  it("keeps a short cue on its own when the next one is far away", () => {
    const out = normalizeCaptions([
      { start: 0, end: 0.5, text: "Hi!" },
      { start: 10, end: 12, text: "Later." },
    ]);
    expect(out.map((c) => c.text)).toEqual(["Hi!", "Later."]);
  });

  it("splits cues longer than 8s at punctuation, sharing the time", () => {
    const out = normalizeCaptions([
      { start: 0, end: 20, text: "Volcanoes are mountains. They have hot rock inside. Some erupt often, others sleep." },
    ]);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out[0]!.start).toBe(0);
    expect(out.at(-1)!.end).toBe(20);
    expect(out.every((c) => c.end - c.start <= 9)).toBe(true);
    expect(isSortedNonOverlapping(out)).toBe(true);
    expect(out.map((c) => c.text).join(" ")).toBe("Volcanoes are mountains. They have hot rock inside. Some erupt often, others sleep.");
  });

  it("splits long cues without punctuation at word boundaries", () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    const out = normalizeCaptions([{ start: 0, end: 24, text: words }]);
    expect(out.length).toBe(3);
    expect(out.map((c) => c.text).join(" ")).toBe(words);
  });
});
