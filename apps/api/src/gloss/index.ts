import Cerebras from "@cerebras/cerebras_cloud_sdk";
import pLimit from "p-limit";
import {
  batchSchema,
  captionsSchema,
  optionsSchema,
  glossBatchJsonSchema,
} from "./schemas";
import {
  cleanText,
  fallbackTokens,
  normalizeTokens,
  prepareCaptions,
} from "./words";
import { systemPrompt } from "./prompt";
import { timeSigns } from "./timing";
import type { Caption, GlossOptions, Segment } from "./types";

export type {
  Caption,
  GlossOptions,
  Segment,
  Sign,
  VideoContext,
} from "./types";

interface Completion {
  choices: {
    message: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface GlossRequest {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  response_format: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
}

interface Dependencies {
  model?: string;
  complete?: (request: GlossRequest) => Promise<Completion>;
  wait?: (ms: number) => Promise<void>;
  log?: (event: Record<string, unknown>) => void;
}

function setting(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max)
    throw new Error(`Invalid gloss setting: expected 1–${max}`);
  return parsed;
}

export function createGlossTranslator(dependencies: Dependencies = {}) {
  return async function translate(
    captions: Caption[],
    opts: GlossOptions,
  ): Promise<Segment[]> {
    const started = performance.now();
    const input = captionsSchema.parse(captions);
    const options = optionsSchema.parse(opts);
    if (options.lang !== "ASL")
      throw new Error("ISL grammar is not implemented; request ASL");
    const prepared = prepareCaptions(input);
    const dictionary = new Set(options.dictionary);
    const env = globalThis.process.env;
    const free = env.CEREBRAS_TIER === "free";
    const batchSize = setting(env.CEREBRAS_BATCH_SIZE, free ? 60 : 20, 60);
    const concurrency = free ? 1 : setting(env.CEREBRAS_CONCURRENCY, 4, 4);
    const model = dependencies.model ?? env.CEREBRAS_MODEL ?? "gpt-oss-120b";
    const wait =
      dependencies.wait ??
      ((ms) =>
        new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms)));
    const log =
      dependencies.log ??
      ((event) => globalThis.console.info(JSON.stringify(event)));
    let complete = dependencies.complete;
    if (!complete && env.CEREBRAS_API_KEY) {
      const client = new Cerebras({
        apiKey: env.CEREBRAS_API_KEY,
        maxRetries: 0,
        timeout: 15_000,
      });
      complete = async (request) =>
        (await client.chat.completions.create({
          ...request,
          stream: false,
        })) as Completion;
    }
    const allTokens: string[][] = prepared.map(() => []);
    const active = prepared
      .map((caption, index) => ({ index, text: cleanText(caption.text) }))
      .filter(({ text }) => text.length > 0);
    const limit = pLimit(concurrency);
    let totalTokens = 0;
    let fallbackBatches = 0;
    // Keep the queue within this video. The API owner applies the account-wide request limit.
    await Promise.all(
      Array.from(
        { length: Math.ceil(active.length / batchSize) },
        (_, batchIndex) =>
          limit(async () => {
            const batch = active.slice(
              batchIndex * batchSize,
              (batchIndex + 1) * batchSize,
            );
            let invalid = 0;
            let rateRetries = 0;
            if (complete) {
              while (true) {
                const callStarted = performance.now();
                try {
                  const response = await complete({
                    model,
                    messages: [
                      {
                        role: "system",
                        content: systemPrompt(
                          options.dictionary,
                          options.context,
                        ),
                      },
                      {
                        role: "user",
                        content: JSON.stringify({ segments: batch }),
                      },
                    ],
                    response_format: {
                      type: "json_schema",
                      json_schema: {
                        name: "gloss_batch",
                        strict: true,
                        schema: glossBatchJsonSchema,
                      },
                    },
                  });
                  const elapsedMs = performance.now() - callStarted;
                  totalTokens += response.usage?.total_tokens ?? 0;
                  log({
                    event: "gloss.call",
                    model,
                    batch: batchIndex,
                    elapsedMs,
                    ...response.usage,
                    tokensPerSecond:
                      (response.usage?.completion_tokens ?? 0) /
                      Math.max(elapsedMs / 1000, 0.001),
                  });
                  try {
                    const choice = response.choices[0];
                    if (
                      choice?.finish_reason &&
                      choice.finish_reason !== "stop"
                    )
                      throw new Error("Incomplete gloss response");
                    const result = batchSchema.parse(
                      JSON.parse(choice?.message.content ?? ""),
                    );
                    const indices = new Set(
                      result.segments.map((segment) => segment.index),
                    );
                    if (
                      result.segments.length !== batch.length ||
                      indices.size !== batch.length ||
                      batch.some(({ index }) => !indices.has(index))
                    ) {
                      throw new Error(
                        "Gloss response did not cover the batch indices exactly",
                      );
                    }
                    for (const segment of result.segments) {
                      if (
                        normalizeTokens(segment.tokens, dictionary).length ===
                          0 &&
                        fallbackTokens(
                          batch.find(({ index }) => index === segment.index)
                            ?.text ?? "",
                        ).length > 0
                      ) {
                        throw new Error(
                          "Gloss response omitted caption content",
                        );
                      }
                    }
                    for (const segment of result.segments)
                      allTokens[segment.index] = normalizeTokens(
                        segment.tokens,
                        dictionary,
                      );
                    return;
                  } catch {
                    if (invalid++ === 0) continue;
                    log({
                      event: "gloss.fallback",
                      batch: batchIndex,
                      reason: "invalid-output",
                    });
                    break;
                  }
                } catch (error) {
                  const status =
                    error && typeof error === "object" && "status" in error
                      ? error.status
                      : undefined;
                  if (status === 429 && rateRetries < 3) {
                    const delayMs = 1000 * 2 ** rateRetries++;
                    log({
                      event: "gloss.retry",
                      batch: batchIndex,
                      status,
                      delayMs,
                    });
                    await wait(delayMs);
                    continue;
                  }
                  log({
                    event: "gloss.fallback",
                    batch: batchIndex,
                    reason: status === 429 ? "rate-limit" : "provider-error",
                  });
                  break;
                }
              }
            }
            fallbackBatches++;
            for (const segment of batch)
              allTokens[segment.index] = normalizeTokens(
                fallbackTokens(segment.text),
                dictionary,
              );
          }),
      ),
    );
    const segments = timeSigns(prepared, allTokens);
    log({
      event: "gloss.video",
      model,
      elapsedMs: performance.now() - started,
      totalTokens,
      fallbackBatches,
      segments: segments.length,
    });
    return segments;
  };
}

export const textToSigns = createGlossTranslator();
