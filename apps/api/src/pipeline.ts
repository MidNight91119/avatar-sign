/**
 * Builds a SignTrack for one video (spec §3): captions → Exa context → gloss, with progress.
 * All dependencies are injected so tests run without YouTube, Exa or Cerebras.
 */
import type { Caption, Segment, SignLang, SignTrack, SignTrackError, VideoContext } from "@signstream/shared";
import type { Transcript } from "./transcript";
import { TranscriptError } from "./transcript";

export interface PipelineDeps {
  getTranscript(videoId: string): Promise<Transcript>;
  getContext(videoId: string, title: string, description: string): Promise<VideoContext | undefined>;
  textToSigns(captions: Caption[], opts: { lang: SignLang; dictionary: string[]; context?: VideoContext }): Promise<Segment[]>;
  dictionary(lang: SignLang): string[];
  maxVideoSeconds: number;
  /** Captions per gloss call; progress is reported after each batch. */
  batchSize?: number;
  now?: () => number;
}

export interface JobMetrics {
  videoId: string;
  lang: SignLang;
  status: SignTrack["status"];
  error?: SignTrackError;
  captions: number;
  signs: number;
  /** Share of signs that are fingerspelled (FS:…), 0–1. */
  fingerspelled: number;
  exaMs: number;
  glossMs: number;
  totalMs: number;
  context: boolean;
}

export class PipelineError extends Error {
  readonly code: SignTrackError;
  constructor(code: SignTrackError, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

export function errorCode(e: unknown): SignTrackError {
  if (e instanceof TranscriptError || e instanceof PipelineError) return e.code;
  return "INTERNAL";
}

export async function buildSignTrack(
  videoId: string,
  lang: SignLang,
  deps: PipelineDeps,
  /** `segments` = the segments glossed so far (partial results, so the avatar can start early). */
  onProgress: (progress: number, segments?: Segment[]) => void = () => {},
  source: SignTrack["source"] = "youtube-captions",
): Promise<{ track: SignTrack; metrics: JobMetrics }> {
  const now = deps.now ?? Date.now;
  const t0 = now();
  const metrics: JobMetrics = {
    videoId, lang, status: "processing", captions: 0, signs: 0, fingerspelled: 0, exaMs: 0, glossMs: 0, totalMs: 0, context: false,
  };
  const base = { videoId, lang, source };

  try {
    const transcript = await deps.getTranscript(videoId);
    if (transcript.durationSec > deps.maxVideoSeconds) {
      throw new PipelineError("VIDEO_TOO_LONG", `Videos longer than ${Math.round(deps.maxVideoSeconds / 60)} minutes are not supported yet`);
    }
    metrics.captions = transcript.captions.length;
    onProgress(0.15);

    const tExa = now();
    const context = await deps.getContext(videoId, transcript.title, transcript.description);
    metrics.exaMs = now() - tExa;
    metrics.context = context !== undefined;
    onProgress(0.25);

    const tGloss = now();
    const batchSize = deps.batchSize ?? 40;
    const dictionary = deps.dictionary(lang);
    const segments: Segment[] = [];
    for (let i = 0; i < transcript.captions.length; i += batchSize) {
      const batch = transcript.captions.slice(i, i + batchSize);
      try {
        segments.push(...(await deps.textToSigns(batch, { lang, dictionary, context })));
      } catch (e) {
        throw new PipelineError("GLOSS_FAILED", `Gloss failed: ${(e as Error).message}`);
      }
      onProgress(0.25 + 0.75 * Math.min(1, (i + batch.length) / transcript.captions.length), [...segments]);
    }
    metrics.glossMs = now() - tGloss;

    const signs = segments.flatMap((s) => s.signs);
    metrics.signs = signs.length;
    metrics.fingerspelled = signs.length ? signs.filter((s) => s.gloss.startsWith("FS:")).length / signs.length : 0;
    metrics.status = "ready";
    metrics.totalMs = now() - t0;
    return { track: { ...base, status: "ready", progress: 1, segments }, metrics };
  } catch (e) {
    const code = errorCode(e);
    metrics.status = "error";
    metrics.error = code;
    metrics.totalMs = now() - t0;
    return { track: { ...base, status: "error", error: code, segments: [] }, metrics };
  }
}

/** One log line per job (spec §4): no captions text, no keys. */
export function formatMetrics(m: JobMetrics): string {
  const parts = [
    `job ${m.videoId}:${m.lang}`,
    `status=${m.status}${m.error ? `(${m.error})` : ""}`,
    `captions=${m.captions}`,
    `signs=${m.signs}`,
    `fs=${(m.fingerspelled * 100).toFixed(0)}%`,
    `context=${m.context ? "yes" : "no"}`,
    `exa=${m.exaMs}ms`,
    `gloss=${m.glossMs}ms`,
    `total=${m.totalMs}ms`,
  ];
  return parts.join(" ");
}
