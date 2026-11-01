import { expect, it } from "bun:test";
import { SignTrackSchema, type Segment } from "@signstream/shared";
import { buildSignTrack } from "../pipeline";
import { normalizeCaptions } from "../captions";
import { createGlossTranslator } from "./index";

it.each([false, true])(
  "keeps pipeline partial/final schedules valid across caption 40 (raw overlap=%s)",
  async (overlap) => {
    const captions = Array.from({ length: 41 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 1.6,
      text: "Hello",
    }));
    if (overlap) captions[39]!.end = captions[40]!.start + 1;
    const normalized = normalizeCaptions(captions);
    const partials: Segment[][] = [];
    let batches = 0;
    const translate = createGlossTranslator({
      log: () => {},
      complete: async (request) => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                segments: (
                  JSON.parse(request.messages[1]!.content).segments as {
                    index: number;
                  }[]
                ).map(({ index }) => ({ index, tokens: ["HELLO"] })),
              }),
            },
          },
        ],
      }),
    });
    const { track } = await buildSignTrack(
      "fixture-pipeline",
      "ASL",
      {
        getTranscript: async () => ({
          videoId: "fixture-pipeline",
          title: "Fixture",
          description: "",
          durationSec: 82,
          captions: normalized,
          track: { languageCode: "en", auto: false },
        }),
        getContext: async () => undefined,
        textToSigns: async (...args) => {
          batches++;
          return translate(...args);
        },
        dictionary: () => ["HELLO"],
        maxVideoSeconds: 900,
        batchSize: 40,
      },
      (_progress, segments) => {
        if (segments) partials.push(segments);
      },
    );
    expect(batches).toBe(2);
    expect(track.status).toBe("ready");
    expect(track.segments).toHaveLength(41);
    expect(partials.map((segments) => segments.length)).toEqual([40, 41]);
    for (const segments of [...partials, track.segments]) {
      expect(SignTrackSchema.safeParse({ ...track, segments }).success).toBe(
        true,
      );
      let previousEnd = 0;
      for (const segment of segments)
        for (const sign of segment.signs) {
          expect(sign.start + 1e-8).toBeGreaterThanOrEqual(previousEnd);
          expect(sign.duration).toBeGreaterThanOrEqual(0.25);
          previousEnd = sign.start + sign.duration;
        }
    }
  },
);
