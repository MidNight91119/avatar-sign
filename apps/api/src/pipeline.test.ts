import { describe, expect, it } from "bun:test";
import type { Caption, Segment } from "@signstream/shared";
import { createGlossTranslator } from "./gloss";
import { buildSignTrack, clipOverlaps, formatMetrics } from "./pipeline";
import { TranscriptError } from "./transcript";
import { VIDEO, fakeDeps, transcript } from "./test-helpers";

describe("buildSignTrack", () => {
  it("builds a ready track, batches gloss calls and reports rising progress", async () => {
    const deps = fakeDeps();
    const progress: number[] = [];
    const { track, metrics } = await buildSignTrack(VIDEO, "ASL", deps, (p) => progress.push(p));
    expect(track.status).toBe("ready");
    expect(track.segments).toHaveLength(3);
    expect(deps.calls.gloss).toBe(2); // 3 captions, batches of 2
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(deps.contexts[0]?.topic).toBe("Volcanoes");
    expect(metrics.captions).toBe(3);
    expect(metrics.signs).toBeGreaterThan(0);
    expect(metrics.fingerspelled).toBeGreaterThan(0);
    expect(metrics.context).toBe(true);
  });

  it("still finishes when Exa gives no context", async () => {
    const deps = fakeDeps({ getContext: async () => undefined });
    const { track, metrics } = await buildSignTrack(VIDEO, "ASL", deps);
    expect(track.status).toBe("ready");
    expect(deps.contexts.every((c) => c === undefined)).toBe(true);
    expect(metrics.context).toBe(false);
  });

  it("turns transcript errors into error tracks with the same code", async () => {
    const deps = fakeDeps({
      getTranscript: async () => {
        throw new TranscriptError("NO_CAPTIONS", "none");
      },
    });
    const { track } = await buildSignTrack(VIDEO, "ASL", deps);
    expect(track).toMatchObject({ status: "error", error: "NO_CAPTIONS", segments: [] });
  });

  it("refuses videos over the length limit without calling Exa or the gloss", async () => {
    const deps = fakeDeps({ getTranscript: async () => transcript({ durationSec: 3600 }) });
    const { track } = await buildSignTrack(VIDEO, "ASL", deps);
    expect(track.error).toBe("VIDEO_TOO_LONG");
    expect(deps.calls.context).toBe(0);
    expect(deps.calls.gloss).toBe(0);
  });

  it("reports GLOSS_FAILED when the gloss throws, and INTERNAL for unknown errors", async () => {
    const failingGloss = fakeDeps({
      textToSigns: async () => {
        throw new Error("Cerebras 500");
      },
    });
    expect((await buildSignTrack(VIDEO, "ASL", failingGloss)).track.error).toBe("GLOSS_FAILED");
    const broken = fakeDeps({
      getTranscript: async () => {
        throw new Error("boom");
      },
    });
    expect((await buildSignTrack(VIDEO, "ASL", broken)).track.error).toBe("INTERNAL");
  });

  it("formats one log line without caption text", async () => {
    const { metrics } = await buildSignTrack(VIDEO, "ASL", fakeDeps());
    const line = formatMetrics(metrics);
    expect(line).toStartWith(`job ${VIDEO}:ASL status=ready captions=3`);
    expect(line).toContain("context=yes");
    expect(line).not.toContain("volcanoes");
  });
});

/** The real translator with a fake model that signs every word, so timing is the production code. */
function realTranslator() {
  const requests: string[] = [];
  const translate = createGlossTranslator({
    log: () => {},
    complete: async (request) => {
      const body = JSON.parse(request.messages[1]!.content) as { segments: { index: number; text: string }[] };
      requests.push(...body.segments.map((s) => s.text));
      const segments = body.segments.map(({ index, text }) => ({
        index,
        tokens: text.split(/\s+/).filter(Boolean).map((w) => w.replace(/[^A-Za-z]/g, "").toUpperCase()),
      }));
      return { choices: [{ message: { content: JSON.stringify({ segments }) }, finish_reason: "stop" }] };
    },
  });
  return { translate, requests };
}

function captionsAround(boundaryGap: number): Caption[] {
  // 45 captions; the API batch boundary sits between captions 39 and 40 (0-based).
  return Array.from({ length: 45 }, (_, i) => {
    const start = i * 2;
    const gap = i === 39 ? boundaryGap : 0.2;
    return { start, end: start + 2 - gap, text: "hello friend my name is anna and today we cook" };
  });
}

function flatSigns(segments: Segment[]) {
  return segments.flatMap((s) => s.signs).map((x) => ({ start: x.start, end: x.start + x.duration }));
}

function expectNoOverlap(segments: Segment[], until = Infinity) {
  const signs = flatSigns(segments);
  for (let i = 1; i < signs.length; i++) expect(signs[i]!.start).toBeGreaterThanOrEqual(signs[i - 1]!.end - 1e-9);
  for (const x of signs) expect(x.end).toBeLessThanOrEqual(until + 1e-9);
}

describe("batch boundaries (R-I4)", () => {
  for (const gap of [0, 0.3]) {
    it(`matches whole-track timing across captions 39/40 with gap=${gap}s, in partial and final tracks`, async () => {
      const captions = captionsAround(gap);
      const { translate, requests } = realTranslator();
      const partials: Segment[][] = [];
      const deps = fakeDeps({ batchSize: 40, getTranscript: async () => transcript({ captions }), textToSigns: translate });
      const { track } = await buildSignTrack(VIDEO, "ASL", deps, (_p, segs) => segs && partials.push(segs));
      const whole = await translate(captions, { lang: "ASL", dictionary: deps.dictionary("ASL") });

      expect(track.status).toBe("ready");
      expect(track.segments).toEqual(whole);
      expect(requests.filter((t) => t === "")).toHaveLength(0); // the look-ahead cue is never sent to the model
      expect(partials[0]).toHaveLength(40);
      expectNoOverlap(partials[0]!, captions[40]!.start);
      expect(partials[0]).toEqual(whole.slice(0, 40)); // a partial never shows a sign the final track changes
      expectNoOverlap(track.segments);
    });
  }

  it("never emits overlapping signs when source captions overlap", async () => {
    const captions = captionsAround(0).map((c, i) => (i === 39 ? { ...c, end: c.end + 1.5 } : c));
    const { translate } = realTranslator();
    const partials: Segment[][] = [];
    const deps = fakeDeps({ batchSize: 40, getTranscript: async () => transcript({ captions }), textToSigns: translate });
    const { track } = await buildSignTrack(VIDEO, "ASL", deps, (_p, segs) => segs && partials.push(segs));
    expectNoOverlap(partials[0]!, captions[40]!.start);
    expectNoOverlap(track.segments);
  });
});

describe("clipOverlaps", () => {
  const seg = (signs: [number, number][]): Segment => ({
    start: signs[0]?.[0] ?? 0,
    end: 10,
    text: "x",
    signs: signs.map(([start, duration], i) => ({ gloss: `S${i}`, start, duration })),
  });

  it("shortens a sign that runs into the next one and drops signs with no time left", () => {
    const out = clipOverlaps([seg([[0, 1], [0.9, 0.5]]), seg([[1.3, 1], [1.32, 1]])]);
    expect(out[0]!.signs[0]!.duration).toBe(0.9);
    expect(out[0]!.signs[1]!.duration).toBeCloseTo(0.42); // runs to the next surviving sign at 1.32
    expect(out[1]!.signs.map((s) => s.start)).toEqual([1.32]); // 1.3 had only 0.02s before the next sign
  });

  it("clips to the boundary of the first caption not glossed yet", () => {
    const out = clipOverlaps([seg([[0, 1], [1, 1]])], 1.5);
    expect(out[0]!.signs.map((s) => s.start + s.duration)).toEqual([1, 1.5]);
  });

  it("leaves a clean track untouched", () => {
    const clean = [seg([[0, 1], [1, 1]])];
    expect(clipOverlaps(structuredClone(clean))).toEqual(clean);
  });
});
