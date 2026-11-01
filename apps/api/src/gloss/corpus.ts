import { z } from "zod";
import { createGlossTranslator } from "./index";
import { captionsSchema, contextSchema, segmentSchema } from "./schemas";
import { missingSignsReport } from "./missing-signs";
import { rankWords, signCoverage } from "./vocabulary";

const corpusSchema = z
  .object({
    source: z.enum(["youtube-captions", "manual", "fixture"]),
    videos: z
      .array(
        z.object({
          videoId: z.string().min(1),
          captions: captionsSchema.min(1),
          context: contextSchema.optional(),
        }),
      )
      .min(1),
  })
  .refine(
    ({ videos }) =>
      new Set(videos.map(({ videoId }) => videoId)).size === videos.length,
    "Duplicate video IDs",
  );

export async function evaluateCorpus(
  input: unknown,
  dictionary: string[],
  options: { live: boolean; api?: string },
  dependencies: Parameters<typeof createGlossTranslator>[0] = {},
) {
  const corpus = corpusSchema.parse(input);
  if (
    options.live &&
    !dependencies.complete &&
    !globalThis.process.env.CEREBRAS_API_KEY
  )
    throw new Error(
      "Live corpus evaluation requires your development CEREBRAS_API_KEY",
    );
  const mode = dependencies.complete
    ? "mock"
    : options.live
      ? "live"
      : "offline-rule-fallback";
  const known = new Set(dictionary);
  const videos = [];
  const allSegments = [];
  for (const video of corpus.videos) {
    let fallbackBatches = 0;
    let providerCalls = 0;
    let providerTokens = 0;
    const translate = createGlossTranslator({
      ...dependencies,
      ...(!options.live && !dependencies.complete
        ? {
            complete: async () => {
              throw new Error("Offline corpus evaluation");
            },
          }
        : {}),
      log: (event) => {
        if (event.event === "gloss.call") providerCalls++;
        if (event.event === "gloss.video") {
          fallbackBatches += Number(event.fallbackBatches);
          providerTokens += Number(event.totalTokens);
        }
        if (options.live && mode !== "mock")
          globalThis.console.error(JSON.stringify(event));
      },
    });
    const started = performance.now();
    const segments = z.array(segmentSchema).parse(
      await translate(video.captions, {
        lang: "ASL",
        dictionary,
        context: video.context,
      }),
    );
    const elapsedMs = performance.now() - started;
    const signs = segments.flatMap(({ signs }) => signs);
    let previousEnd = 0;
    let timingViolations = 0;
    for (const segment of segments)
      for (const sign of segment.signs) {
        if (
          sign.start + 1e-8 < previousEnd ||
          sign.start + 1e-8 < segment.start ||
          sign.start + sign.duration > segment.end + 0.5 + 1e-8
        )
          timingViolations++;
        previousEnd = sign.start + sign.duration;
      }
    const invalidGlosses = signs.filter(
      ({ gloss }) => !known.has(gloss) && !/^FS:[\p{L}\p{N}]+$/u.test(gloss),
    ).length;
    videos.push({
      videoId: video.videoId,
      durationSeconds: Math.max(...video.captions.map(({ end }) => end)),
      elapsedMs,
      providerCalls,
      providerTokens,
      fallbackBatches,
      ...signCoverage(
        signs.map(({ gloss }) => gloss),
        known,
      ),
      timingViolations,
      invalidGlosses,
      tooFastSigns: signs.filter(({ duration }) => duration < 0.25 - 1e-8)
        .length,
      tooSlowSigns: signs.filter(({ duration }) => duration > 1.2 + 1e-8)
        .length,
      providerOnly:
        mode === "live" && providerCalls > 0 && fallbackBatches === 0,
    });
    allSegments.push(...segments);
  }
  const missing = await missingSignsReport(allSegments, options.api);
  const criteria = {
    fiveVideos: videos.length === 5,
    realData: corpus.source !== "fixture",
    providerOnly: videos.every(({ providerOnly }) => providerOnly),
    coverage: videos.every(
      ({ tokens, coveragePercent, invalidGlosses }) =>
        tokens > 0 && coveragePercent >= 70 && invalidGlosses === 0,
    ),
    timing: videos.every(
      ({ timingViolations, tooFastSigns, tooSlowSigns }) =>
        timingViolations === 0 && tooFastSigns === 0 && tooSlowSigns === 0,
    ),
    references: missing.every(
      ({ referenceStatus, references }) =>
        referenceStatus === "not-applicable" ||
        (referenceStatus === "ready" && references.length > 0),
    ),
    threeMinuteUnder10Seconds: videos.some(
      ({ durationSeconds, elapsedMs, providerOnly }) =>
        durationSeconds >= 180 && elapsedMs < 10_000 && providerOnly,
    ),
  };
  return {
    mode,
    source: corpus.source,
    videos,
    ...signCoverage(
      allSegments.flatMap(({ signs }) => signs.map(({ gloss }) => gloss)),
      known,
    ),
    priorities: rankWords(corpus.videos.flatMap(({ captions }) => captions)),
    missing,
    acceptance: {
      scope: "five-video coverage, timing, sign references and speed",
      status:
        mode !== "live" || !criteria.realData
          ? "blocked"
          : Object.values(criteria).every(Boolean)
            ? "passed"
            : "failed",
      criteria,
    },
  };
}
