import { z } from "zod";
import {
  CaptionSchema,
  VideoContextSchema,
  SignLangSchema,
  SegmentSchema,
} from "@signstream/shared";

export const captionSchema = CaptionSchema;

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

export const contextSchema = VideoContextSchema;

export const optionsSchema = z.object({
  lang: SignLangSchema,
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
  lang: SignLangSchema,
  signs: z.record(z.string(), z.string()),
  letters: z.record(z.string(), z.string()),
});

export const segmentSchema = SegmentSchema.refine(
  (segment) => segment.end >= segment.start,
  "Caption end precedes start",
);
