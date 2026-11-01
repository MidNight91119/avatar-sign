import { describe, expect, it } from "bun:test";
import { loadEnv } from "./env";
import { createBudgetedTranslator, createCerebrasBudget, estimateGlossTokens } from "./services";

const captions = Array.from({ length: 25 }, (_, i) => ({ start: i * 2, end: i * 2 + 1.8, text: `hello number ${i}` }));

describe("createBudgetedTranslator", () => {
  it("sends every gloss call from simultaneous videos through one budget", async () => {
    const env = loadEnv({ CEREBRAS_API_KEY: "test-key", CEREBRAS_MAX_CONCURRENT: "2", CEREBRAS_REQUESTS_PER_MINUTE: "1000" });
    const budget = createCerebrasBudget(env);
    let active = 0;
    let peak = 0;
    let calls = 0;
    const translate = createBudgetedTranslator(env, budget, async (request) => {
      calls++;
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 3));
      active--;
      const body = JSON.parse(request.messages[1]!.content) as { segments: { index: number; text: string }[] };
      const segments = body.segments.map(({ index }) => ({ index, tokens: ["HELLO"] }));
      return { choices: [{ message: { content: JSON.stringify({ segments }) }, finish_reason: "stop" }] };
    });
    // Three videos at once; the gloss module alone would run up to 4 calls per video.
    await Promise.all([0, 1, 2].map(() => translate(captions, { lang: "ASL", dictionary: ["HELLO"] })));
    expect(calls).toBe(6); // 25 captions = 2 inner batches of 20 per video
    expect(peak).toBe(2);
    expect(budget.stats()).toMatchObject({ started: 6, inFlight: 0, queued: 0 });
  });

  it("charges real usage from the response to the token window", async () => {
    const env = loadEnv({ CEREBRAS_API_KEY: "test-key", CEREBRAS_TOKENS_PER_MINUTE: "100000" });
    const budget = createCerebrasBudget(env);
    const translate = createBudgetedTranslator(env, budget, async (request) => {
      const body = JSON.parse(request.messages[1]!.content) as { segments: { index: number }[] };
      const segments = body.segments.map(({ index }) => ({ index, tokens: ["HELLO"] }));
      return { choices: [{ message: { content: JSON.stringify({ segments }) }, finish_reason: "stop" }], usage: { total_tokens: 1234 } };
    });
    await translate(captions.slice(0, 5), { lang: "ASL", dictionary: ["HELLO"] });
    expect(budget.stats().tokensLastMinute).toBe(1234);
  });
});

describe("estimateGlossTokens", () => {
  it("grows with the batch and stays near the ~5k measured for 40 captions", () => {
    const req = (n: number) => ({
      model: "m",
      messages: [
        { role: "system" as const, content: "x".repeat(2000) },
        { role: "user" as const, content: JSON.stringify({ segments: Array.from({ length: n }, (_, i) => ({ index: i, text: "hello there friend" })) }) },
      ],
      response_format: { type: "json_schema" as const, json_schema: { name: "g", strict: true as const, schema: {} } },
    });
    const forty = estimateGlossTokens(req(40));
    expect(forty).toBeGreaterThan(4000);
    expect(forty).toBeLessThan(8000);
    expect(estimateGlossTokens(req(10))).toBeLessThan(forty);
  });
});
