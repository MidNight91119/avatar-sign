import { z } from "zod";
import { SIGN_LANGS } from "@signstream/shared";

export const captionSchema = z
  .object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().nonnegative(),
    text: z.string(),
  })
  .refine(
    (caption) => caption.end >= caption.start,
    "Caption end precedes start",
  );

export const captionsSchema = z
  .array(captionSchema)
  .refine(
    (captions) =>
      captions.every(
        (caption, i) =>
          i === 0 || caption.start > (captions[i - 1]?.start ?? -1),
      ),
    "Caption starts must be strictly increasing",
  );

export const contextSchema = z.object({
  topic: z.string(),
  names: z.array(z.string()),
  terms: z.array(z.object({ term: z.string(), meaning: z.string() })),
});

export const optionsSchema = z.object({
  lang: z.enum(SIGN_LANGS),
  dictionary: z.array(z.string().regex(/^[A-Z][A-Z0-9_-]*$/)),
  context: contextSchema.optional(),
});

const modelSegmentSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  tokens: z.array(z.string()),
});

// Cerebras strict mode rejects array limits; string-length support varies by model.
export const glossBatchJsonSchema = z.toJSONSchema(
  z.strictObject({
    segments: z.array(modelSegmentSchema),
  }),
);

export const batchSchema = z.strictObject({
  segments: z.array(
    modelSegmentSchema.extend({
      tokens: z.array(z.string().max(200)).max(100),
    }),
  ),
});

export const dictionarySchema = z.object({
  lang: z.enum(SIGN_LANGS),
  signs: z.record(z.string(), z.string()),
  letters: z.record(z.string(), z.string()),
});

export const segmentSchema = captionSchema.safeExtend({
  signs: z.array(
    z.object({
      gloss: z.string().min(1),
      start: z.number().finite().nonnegative(),
      duration: z.number().finite().positive(),
      nonManual: z.enum(["question", "negation", "emphasis"]).optional(),
    }),
  ),
});
