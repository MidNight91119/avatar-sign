import { getTranscript, youtubeSource, type VideoSource } from "../transcript";
import { evaluateCorpus } from "./corpus";
import { argumentsForCli, readDictionary } from "./cli";
import type { createGlossTranslator } from "./index";

export async function benchmarkVideo(
  videoId: string,
  dictionary: string[],
  live: boolean,
  dependencies: Parameters<typeof createGlossTranslator>[0] & {
    source?: VideoSource;
  } = {},
) {
  const started = performance.now();
  const transcript = await getTranscript(
    videoId,
    dependencies.source ?? youtubeSource(),
  );
  if (transcript.durationSec > 900)
    throw new Error("Benchmark exceeds the 15-minute API limit");
  const report = await evaluateCorpus(
    {
      source: dependencies.source ? "fixture" : "youtube-captions",
      videos: [{ videoId, captions: transcript.captions }],
    },
    dictionary,
    { live },
    dependencies,
  );
  const elapsedMs = performance.now() - started;
  const video = report.videos[0]!;
  const criteria = {
    fullVideoAtLeast3Minutes: transcript.durationSec >= 180,
    providerOnly: !dependencies.source && video.providerOnly,
    glossUnder10Seconds: video.elapsedMs < 10_000,
    captionsAndGlossUnder10Seconds: elapsedMs < 10_000,
    validTiming: report.acceptance.criteria.timing,
  };
  return {
    scope:
      "full YouTube caption fetch plus gloss; excludes Exa and avatar asset loading",
    title: transcript.title,
    url: `https://youtu.be/${videoId}`,
    source: report.source,
    captionCount: transcript.captions.length,
    captionTrack: transcript.track,
    glossElapsedMs: video.elapsedMs,
    mode: dependencies.source ? "fixture" : report.mode,
    ...video,
    durationSeconds: transcript.durationSec,
    // Whole-operation time is distinct from the per-video gloss time above.
    captionsAndGlossElapsedMs: elapsedMs,
    acceptance: {
      scope:
        "speed and numeric timing only; excludes animation coverage and linguistic/readability acceptance",
      status:
        !live || dependencies.source || dependencies.complete
          ? "blocked"
          : Object.values(criteria).every(Boolean)
            ? "passed"
            : "failed",
      criteria,
    },
  };
}

if (import.meta.main) {
  const args = argumentsForCli();
  if (!args.video)
    throw new Error(
      "Supply --video <YouTube video ID> and opt into sponsor calls with --live",
    );
  const report = await benchmarkVideo(
    args.video,
    await readDictionary(args.dictionary),
    args.live,
  );
  globalThis.console.log(JSON.stringify(report, null, 2));
  if (args.check && report.acceptance.status !== "passed")
    globalThis.process.exitCode = 1;
}
