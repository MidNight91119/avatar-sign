/** Shared fakes for API tests. Not used in production code. */
import type { Caption, Segment, VideoContext } from "@signstream/shared";
import type { PipelineDeps } from "./pipeline";
import type { Transcript } from "./transcript";

export const VIDEO = "abcdefghijk";

export const sampleCaptions: Caption[] = [
  { start: 0, end: 2, text: "Hello my name is Bob" },
  { start: 2, end: 4, text: "Today we learn about volcanoes" },
  { start: 4, end: 6, text: "Volcanoes are hot" },
];

export function transcript(over: Partial<Transcript> = {}): Transcript {
  return {
    videoId: VIDEO,
    title: "Volcanoes 101",
    description: "A lesson",
    durationSec: 180,
    captions: sampleCaptions,
    track: { languageCode: "en", auto: false },
    ...over,
  };
}

export interface FakeDeps extends PipelineDeps {
  calls: { transcript: number; context: number; gloss: number };
  contexts: Array<VideoContext | undefined>;
}

/** Pipeline deps with counters; `gate` lets a test hold the transcript step open. */
export function fakeDeps(over: Partial<PipelineDeps> & { gate?: Promise<void> } = {}): FakeDeps {
  const calls = { transcript: 0, context: 0, gloss: 0 };
  const contexts: Array<VideoContext | undefined> = [];
  const deps: FakeDeps = {
    calls,
    contexts,
    maxVideoSeconds: 900,
    batchSize: 2,
    dictionary: () => ["HELLO", "MY", "NAME", "TODAY", "LEARN", "HOT"],
    async getTranscript() {
      calls.transcript++;
      await over.gate;
      return transcript();
    },
    async getContext() {
      calls.context++;
      return { topic: "Volcanoes", names: ["Bob"], terms: [] };
    },
    async textToSigns(captions, opts): Promise<Segment[]> {
      calls.gloss++;
      contexts.push(opts.context);
      return captions.map((c) => ({
        ...c,
        signs: c.text
          .split(" ")
          .map((w, i) => ({ gloss: opts.dictionary.includes(w.toUpperCase()) ? w.toUpperCase() : `FS:${w.toUpperCase()}`, start: c.start + i * 0.1, duration: 0.1 })),
      }));
    },
    ...over,
  };
  return deps;
}
