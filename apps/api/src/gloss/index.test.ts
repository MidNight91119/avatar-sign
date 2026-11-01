import { describe, expect, it } from "bun:test";
import { createGlossTranslator, type GlossRequest } from "./index";
import { EVAL_CASES, EVAL_DICTIONARY } from "./eval-cases";
import {
  cleanText,
  fallbackTokens,
  normalizeTokens,
  prepareCaptions,
} from "./words";
import { timeSigns } from "./timing";
import { evaluate } from "./eval";
import { missingSignsReport, missingWords } from "./missing-signs";
import { EVERYDAY_WORDS, rankWords } from "./vocabulary";
import type { Caption, Segment } from "./types";

const dictionary = [
  "I",
  "YOU",
  "MY",
  "THAT",
  "NOT",
  "GO",
  "STORE",
  "TOMORROW",
  "BIG",
  "BUY",
  "DOG",
  "NAME",
  "YOUR",
  "WHAT",
  "UNDERSTAND",
  "HELLO",
  "THANK-YOU",
];
const options = { lang: "ASL" as const, dictionary };
const quiet = () => {};
const caption = (text = "The dog is big", start = 0, end = 4): Caption => ({
  start,
  end,
  text,
});
const offline = () =>
  createGlossTranslator({
    complete: async () => {
      throw new Error("offline");
    },
    log: quiet,
  });
const response = (segments: { index: number; tokens: string[] }[]) => ({
  choices: [
    {
      message: { content: JSON.stringify({ segments }) },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
});
function assertTiming(segments: Segment[]) {
  let previousEnd = 0;
  for (const segment of segments)
    for (const sign of segment.signs) {
      expect(sign.start).toBeGreaterThanOrEqual(segment.start);
      expect(sign.start + sign.duration).toBeLessThanOrEqual(
        segment.end + 0.50000001,
      );
      expect(sign.start + 1e-8).toBeGreaterThanOrEqual(previousEnd);
      expect(sign.duration).toBeGreaterThan(0);
      expect(sign.duration).toBeLessThanOrEqual(1.20000001);
      previousEnd = sign.start + sign.duration;
    }
}

describe("caption cleanup and dictionary enforcement", () => {
  it("removes annotations, speaker tags, markup and music symbols", () => {
    expect(cleanText("[Music] >> Alice: <i>Hello</i> [Applause] ♪")).toBe(
      "Hello",
    );
    expect(cleanText("SPEAKER 1: Hi (laughter)")).toBe("Hi");
  });
  it("preserves negation and converts synonyms, names and numeric values", () => {
    expect(fallbackTokens("I don't understand")).toEqual([
      "I",
      "NOT",
      "UNDERSTAND",
    ]);
    expect(
      normalizeTokens(
        [
          "large",
          "HUGE",
          "purchase",
          "Bob",
          "FS:O'Neil",
          "23",
          "-3.14",
          "50%",
          "1,000",
          "!!!",
        ],
        new Set(dictionary),
      ),
    ).toEqual([
      "BIG",
      "BIG",
      "BUY",
      "FS:BOB",
      "FS:ONEIL",
      "FS:23",
      "FS:MINUS",
      "FS:3",
      "FS:POINT",
      "FS:14",
      "FS:50",
      "FS:PERCENT",
      "FS:1000",
    ]);
    expect(
      normalizeTokens(["huge", "hello world", "FS:BIG"], new Set()),
    ).toEqual(["FS:HUGE", "FS:HELLO", "FS:WORLD", "FS:BIG"]);
    expect(normalizeTokens(["THANK-YOU"], new Set(dictionary))).toEqual([
      "THANK-YOU",
    ]);
  });
  it("preserves numbers inside multiword provider tokens", () => {
    expect(
      normalizeTokens(["3.14 dogs", "FS:-0.5 50%", ".5"], new Set(["DOGS"])),
    ).toEqual([
      "FS:3",
      "FS:POINT",
      "FS:14",
      "DOGS",
      "FS:MINUS",
      "FS:0",
      "FS:POINT",
      "FS:5",
      "FS:50",
      "FS:PERCENT",
      "FS:0",
      "FS:POINT",
      "FS:5",
    ]);
  });
  it("preserves negation in typographic contractions", () => {
    expect(fallbackTokens("I don’t understand and she can’t hear")).toEqual([
      "I",
      "NOT",
      "UNDERSTAND",
      "AND",
      "SHE",
      "NOT",
      "HEAR",
    ]);
  });
  it("splits long captions into contiguous proportional windows", () => {
    const split = prepareCaptions([
      caption(Array(40).fill("dog").join(" "), 2, 10),
    ]);
    expect(split).toHaveLength(2);
    expect(split[0]?.start).toBe(2);
    expect(split[0]?.end).toBe(split[1]?.start);
    expect(split[1]?.end).toBe(10);
  });
  it("keeps split captions ordered when source windows overlap", async () => {
    const result = await offline()(
      [caption(Array(40).fill("dog").join(" "), 0, 10), caption("big", 3, 4)],
      options,
    );
    expect(result.flatMap(({ signs }) => signs)).toHaveLength(41);
    assertTiming(result);
  });
  it("handles empty, music-only, zero-length and 40-word captions without provider calls", async () => {
    let calls = 0;
    const translate = createGlossTranslator({
      complete: async () => {
        calls++;
        return response([]);
      },
      log: quiet,
    });
    expect(
      (
        await translate(
          [caption(""), caption("[Music]", 5, 6), caption("", 7, 7)],
          options,
        )
      ).flatMap(({ signs }) => signs),
    ).toEqual([]);
    expect(calls).toBe(0);
    const result = await offline()(
      [caption(Array(40).fill("dog").join(" "), 0, 2)],
      options,
    );
    expect(result.flatMap(({ signs }) => signs)).toHaveLength(40);
    assertTiming(result);
  });
  it("validates boundaries, order, language and dictionary keys before translation", async () => {
    const translate = offline();
    for (const captions of [
      [caption("x", -1, 2)],
      [caption("x", 2, 1)],
      [caption("x", 0, Infinity)],
      [caption(), caption()],
    ]) {
      await expect(translate(captions, options)).rejects.toThrow();
    }
    await expect(
      translate([], { ...options, dictionary: ["lowercase"] }),
    ).rejects.toThrow();
    await expect(translate([], { ...options, lang: "ISL" })).rejects.toThrow(
      "ISL",
    );
  });
});

describe("Cerebras translation", () => {
  it("validates five sentences, prompt dictionary and strict nested schema", async () => {
    const requests: GlossRequest[] = [];
    const translate = createGlossTranslator({
      log: quiet,
      complete: async (request) => {
        requests.push(request);
        return response(
          EVAL_CASES.slice(0, 5).map(({ expected }, index) => ({
            index,
            tokens: expected,
          })),
        );
      },
    });
    const output = await translate(
      EVAL_CASES.slice(0, 5).map(({ text }, i) =>
        caption(text, i * 10, i * 10 + 8),
      ),
      { ...options, dictionary: EVAL_DICTIONARY },
    );
    expect(output.map(({ signs }) => signs.map(({ gloss }) => gloss))).toEqual(
      EVAL_CASES.slice(0, 5).map(({ expected }) => expected),
    );
    const request = requests[0]!;
    expect(request.messages[0]?.content).toContain(
      JSON.stringify(EVAL_DICTIONARY),
    );
    expect(request.response_format.json_schema.strict).toBe(true);
    const checkSchema = (schema: unknown): void => {
      if (!schema || typeof schema !== "object") return;
      const object = schema as Record<string, unknown>;
      if (object.type === "object")
        expect(object.additionalProperties).toBe(false);
      for (const keyword of ["minItems", "maxItems", "minLength", "maxLength"])
        expect(object).not.toHaveProperty(keyword);
      for (const value of Object.values(object))
        if (value && typeof value === "object") checkSchema(value);
    };
    checkSchema(request.response_format.json_schema.schema);
    assertTiming(output);
  });
  it("retries invalid JSON exactly once then falls back", async () => {
    let calls = 0;
    const translate = createGlossTranslator({
      log: quiet,
      complete: async () => {
        calls++;
        return { choices: [{ message: { content: "not JSON" } }] };
      },
    });
    const result = await translate([caption()], options);
    expect(calls).toBe(2);
    expect(result[0]?.signs.map(({ gloss }) => gloss)).toEqual(["DOG", "BIG"]);
  });
  it("accepts a valid response on the validation retry", async () => {
    let calls = 0;
    const translate = createGlossTranslator({
      log: quiet,
      complete: async () =>
        ++calls === 1
          ? response([])
          : response([{ index: 0, tokens: ["DOG", "BIG"] }]),
    });
    expect((await translate([caption()], options))[0]?.signs).toHaveLength(2);
    expect(calls).toBe(2);
  });
  it.each([
    { segments: [{ index: 1, tokens: ["DOG"] }] },
    {
      segments: [
        { index: 0, tokens: ["DOG"] },
        { index: 0, tokens: ["BIG"] },
      ],
    },
    { segments: [{ index: 0, tokens: [] }] },
    { segments: [{ index: 0, tokens: ["!!!"] }] },
    { segments: [{ index: 0, tokens: Array(101).fill("DOG") }] },
    { segments: [{ index: 0, tokens: ["A".repeat(201)] }] },
    { segments: [{ index: 0, tokens: "DOG" }] },
    { segments: [{ index: 0, tokens: ["DOG"], extra: true }] },
  ])("rejects malformed/missing/duplicate indexed output %#", async (value) => {
    let calls = 0;
    const translate = createGlossTranslator({
      log: quiet,
      complete: async () => {
        calls++;
        return { choices: [{ message: { content: JSON.stringify(value) } }] };
      },
    });
    expect(
      (await translate([caption()], options))[0]?.signs.map(
        ({ gloss }) => gloss,
      ),
    ).toEqual(["DOG", "BIG"]);
    expect(calls).toBe(2);
  });
  it("does not accept truncated responses", async () => {
    const translate = createGlossTranslator({
      log: quiet,
      complete: async () => ({
        ...response([{ index: 0, tokens: ["HELLO"] }]),
        choices: [
          {
            message: {
              content: JSON.stringify({
                segments: [{ index: 0, tokens: ["HELLO"] }],
              }),
            },
            finish_reason: "length",
          },
        ],
      }),
    });
    expect(
      (await translate([caption()], options))[0]?.signs.map(
        ({ gloss }) => gloss,
      ),
    ).toEqual(["DOG", "BIG"]);
  });
  it("retries 429 three times with exponential backoff then falls back", async () => {
    const delays: number[] = [];
    let calls = 0;
    const translate = createGlossTranslator({
      log: quiet,
      wait: async (ms) => {
        delays.push(ms);
      },
      complete: async () => {
        calls++;
        throw { status: 429 };
      },
    });
    const result = await translate([caption()], options);
    expect(calls).toBe(4);
    expect(delays).toEqual([1000, 2000, 4000]);
    expect(result[0]?.signs).toHaveLength(2);
  });
  it("recovers from a 429 without losing output", async () => {
    let calls = 0;
    const translate = createGlossTranslator({
      log: quiet,
      wait: async () => {},
      complete: async () => {
        if (++calls === 1) throw { status: 429 };
        return response([{ index: 0, tokens: ["HELLO"] }]);
      },
    });
    expect((await translate([caption()], options))[0]?.signs[0]?.gloss).toBe(
      "HELLO",
    );
  });
  it("handles provider errors without retrying non-rate errors or logging secrets", async () => {
    const events: Record<string, unknown>[] = [];
    let calls = 0;
    const translate = createGlossTranslator({
      log: (event) => events.push(event),
      complete: async () => {
        calls++;
        throw new Error("secret-key-private-caption");
      },
    });
    await translate([caption()], options);
    expect(calls).toBe(1);
    expect(JSON.stringify(events)).not.toContain("secret-key-private-caption");
  });
  it("preserves global segment indices when results arrive out of order", async () => {
    const translate = createGlossTranslator({
      log: quiet,
      complete: async (request) => {
        const batch = JSON.parse(request.messages[1]!.content).segments as {
          index: number;
        }[];
        return response(
          [...batch]
            .reverse()
            .map(({ index }) => ({ index, tokens: [`FS:WORD${index}`] })),
        );
      },
    });
    const captions = Array.from({ length: 85 }, (_, i) =>
      caption("word", i * 3, i * 3 + 2),
    );
    const result = await translate(captions, options);
    expect(result.map(({ signs }) => signs[0]?.gloss)).toEqual(
      captions.map((_, i) => `FS:WORD${i}`),
    );
    assertTiming(result);
  });
  it("caps parallel calls at four", async () => {
    let active = 0;
    let max = 0;
    const translate = createGlossTranslator({
      log: quiet,
      complete: async (request) => {
        active++;
        max = Math.max(max, active);
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 5));
        active--;
        const batch = JSON.parse(request.messages[1]!.content).segments as {
          index: number;
        }[];
        return response(
          batch.map(({ index }) => ({ index, tokens: ["HELLO"] })),
        );
      },
    });
    await translate(
      Array.from({ length: 100 }, (_, i) => caption("hello", i * 3, i * 3 + 2)),
      options,
    );
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThan(1);
  });
  it("uses 60-segment sequential batches on the free tier", async () => {
    const env = globalThis.process.env;
    const original = env.CEREBRAS_TIER;
    env.CEREBRAS_TIER = "free";
    const batchSizes: number[] = [];
    let active = 0;
    try {
      const translate = createGlossTranslator({
        log: quiet,
        complete: async (request) => {
          expect(++active).toBe(1);
          const batch = JSON.parse(request.messages[1]!.content).segments as {
            index: number;
          }[];
          batchSizes.push(batch.length);
          await Promise.resolve();
          active--;
          return response(
            batch.map(({ index }) => ({ index, tokens: ["HELLO"] })),
          );
        },
      });
      await translate(
        Array.from({ length: 125 }, (_, i) =>
          caption("hello", i * 3, i * 3 + 2),
        ),
        options,
      );
      expect(batchSizes).toEqual([60, 60, 5]);
    } finally {
      if (original === undefined) delete env.CEREBRAS_TIER;
      else env.CEREBRAS_TIER = original;
    }
  });
  it("passes all five context fixtures and optional context through the prompt", async () => {
    for (const testCase of EVAL_CASES.slice(25)) {
      const translate = createGlossTranslator({
        log: quiet,
        complete: async (request) => {
          expect(request.messages[0]?.content).toContain(
            JSON.stringify(testCase.context),
          );
          return response([{ index: 0, tokens: testCase.expected }]);
        },
      });
      expect(
        (
          await translate([caption(testCase.text, 0, 8)], {
            ...options,
            dictionary: EVAL_DICTIONARY,
            context: testCase.context,
          })
        )[0]?.signs.map(({ gloss }) => gloss),
      ).toEqual(testCase.expected);
    }
    assertTiming(
      await offline()([caption()], { ...options, context: undefined }),
    );
  });
  it("enforces the supplied dictionary on every provider token and on fallback", async () => {
    const translate = createGlossTranslator({
      log: quiet,
      complete: async () =>
        response([{ index: 0, tokens: ["large", "made-up", "FS:BOB", "23"] }]),
    });
    for (const result of [
      await translate([caption()], options),
      await offline()([caption()], options),
    ]) {
      expect(
        result
          .flatMap(({ signs }) => signs)
          .every(
            ({ gloss }) =>
              dictionary.includes(gloss) || /^FS:[\p{L}\p{N}]+$/u.test(gloss),
          ),
      ).toBe(true);
    }
  });
});

describe("timing", () => {
  it("weights fingerspelling, caps long signs and centres idle time", () => {
    const result = timeSigns(
      [caption("x", 0, 10)],
      [["I", "DOG", "FS:ALPHABET"]],
    );
    expect(result[0]?.signs[0]?.start).toBeGreaterThan(0);
    expect(result[0]?.signs[2]?.duration).toBe(1.2);
    assertTiming(result);
    const weighted = timeSigns(
      [caption("x", 0, 2)],
      [["I", "DOG", "FS:ALPHABET"]],
    )[0]!.signs;
    expect(weighted[0]!.duration).toBeLessThan(weighted[1]!.duration);
    expect(weighted[1]!.duration).toBeLessThan(weighted[2]!.duration);
  });
  it("drops fillers first and only overflows into an actual gap", () => {
    const result = timeSigns(
      [caption("x", 0, 0.3), caption("x", 0.8, 2)],
      [["I", "MY", "THAT", "DOG", "BIG"], ["HELLO"]],
    );
    expect(result[0]?.signs.map(({ gloss }) => gloss)).toEqual(["DOG", "BIG"]);
    expect(
      result[0]!.signs.at(-1)!.start + result[0]!.signs.at(-1)!.duration,
    ).toBeLessThanOrEqual(0.8);
    assertTiming(result);
  });
  it("handles overlapping source windows and stress-tests dense captions", () => {
    for (let count = 1; count <= 60; count++) {
      for (const duration of [0.01, 0.2, 1, 5, 40]) {
        const result = timeSigns(
          [caption("x", 0, duration), caption("x", duration / 2, duration + 2)],
          [Array(count).fill("FS:LONGNAME"), ["DOG"]],
        );
        expect(result[0]?.signs).toHaveLength(count);
        assertTiming(result);
      }
    }
    assertTiming(
      timeSigns(
        [caption("x", 0, 2)],
        [[`FS:${"A".repeat(200)}`, ...Array(10).fill("DOG")]],
      ),
    );
    expect(
      timeSigns([caption("x", 0, 0), caption("x", 1, 2)], [["DOG"], ["DOG"]])[0]
        ?.signs,
    ).toEqual([]);
  });
});

describe("handoff reports", () => {
  it("provides 30 eval sentences and exactly 200 distinct provisional word priorities", () => {
    expect(EVAL_CASES).toHaveLength(30);
    expect(EVAL_CASES.filter(({ context }) => context)).toHaveLength(5);
    expect(new Set(EVERYDAY_WORDS).size).toBe(200);
    const priorities = rankWords([caption("huge huge purchase")]);
    expect(priorities[0]).toEqual({ rank: 1, word: "BIG", captionCount: 2 });
    expect(priorities[1]?.word).toBe("BUY");
    expect(priorities).toHaveLength(200);
  });
  it("runs the full evaluator offline and reports honest empty-dictionary coverage", async () => {
    const [report] = await evaluate(false, []);
    expect(report?.sentences).toBe(30);
    expect(report?.coveragePercent).toBe(0);
    expect(report?.providerTokens).toBe(0);
    expect(report?.fallbackBatches).toBeGreaterThan(0);
    expect(
      report?.cases.filter(
        ({ withoutContext }) => withoutContext !== undefined,
      ),
    ).toHaveLength(5);
    expect(report?.contextImprovements).toBe(0);
    expect(report?.contextRegressions).toBe(0);
    expect(report?.acceptance.status).toBe("blocked");
    expect(report?.acceptance.criteria.contextImprovement).toBe(false);
  });
  it("counts missing words by frequency and does not fetch references unless requested", async () => {
    const segments = timeSigns(
      [caption()],
      [["FS:BOB", "DOG", "FS:BOB", "FS:ALICE"]],
    );
    expect(missingWords(segments)).toEqual([
      { word: "BOB", count: 2 },
      { word: "ALICE", count: 1 },
    ]);
    expect((await missingSignsReport(segments))[0]).toEqual({
      word: "BOB",
      count: 2,
      references: [],
      referenceStatus: "not-requested",
    });
  });
  it("fetches reference links once per distinct word and tolerates endpoint failures", async () => {
    const requested: string[] = [];
    const server = globalThis.Bun.serve({
      port: 0,
      fetch: (request) => {
        const url = new URL(request.url);
        expect(url.pathname).toBe("/api/sign-reference");
        const word = url.searchParams.get("word")!;
        requested.push(word);
        return word === "BOB"
          ? Response.json([
              {
                title: "Name reference",
                url: "https://www.lifeprint.com/",
                source: "Lifeprint",
              },
            ])
          : new Response("Unavailable", { status: 503 });
      },
    });
    try {
      const segments = timeSigns(
        [caption()],
        [["FS:BOB", "FS:BOB", "FS:ALICE"]],
      );
      const report = await missingSignsReport(segments, server.url.href);
      expect(requested).toEqual(["BOB", "ALICE"]);
      expect(report[0]?.references).toHaveLength(1);
      expect(report[1]?.referenceStatus).toBe("unavailable");
    } finally {
      await server.stop(true);
    }
  });
});
