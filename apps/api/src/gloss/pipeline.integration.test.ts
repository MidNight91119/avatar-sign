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

it("serves partial gloss through HTTP/client polling and reuses the ready cache", async () => {
  const { createApiClient } = await import("@signstream/shared");
  const { createApp } = await import("../app");
  const { createSqliteCache } = await import("../cache");
  const { createJobManager } = await import("../jobs");
  const { loadEnv } = await import("../env");
  const videoId = "TwsgCHYmbbA";
  const cache = createSqliteCache(":memory:");
  let releaseFinal!: () => void;
  const finalBatch = new Promise<void>((resolve) => {
    releaseFinal = resolve;
  });
  let providerCalls = 0;
  const translate = createGlossTranslator({
    log: () => {},
    complete: async (request) => {
      providerCalls++;
      const batch = JSON.parse(request.messages[1]!.content).segments as {
        index: number;
      }[];
      return {
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                segments: batch.map(({ index }) => ({
                  index,
                  tokens: ["HELLO"],
                })),
              }),
            },
          },
        ],
      };
    },
  });
  const jobs = createJobManager({
    cache,
    log: () => {},
    deps: {
      getTranscript: async () => ({
        videoId,
        title: "HTTP fixture",
        description: "",
        durationSec: 82,
        track: { languageCode: "en", auto: false },
        captions: Array.from({ length: 41 }, (_, i) => ({
          start: i * 2,
          end: i * 2 + 1.6,
          text: "Hello",
        })),
      }),
      getContext: async () => undefined,
      dictionary: () => ["HELLO"],
      maxVideoSeconds: 900,
      textToSigns: async (captions, options) => {
        if (captions[0]!.start >= 80) await finalBatch;
        return translate(captions, options);
      },
    },
  });
  const app = createApp({
    cache,
    jobs,
    dictionary: () => ["HELLO"],
    env: loadEnv({ DATABASE_URL: ":memory:" }),
    log: () => {},
  });
  const client = createApiClient({
    baseUrl: "http://localhost",
    mock: false,
    fetch: Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => app.fetch(new Request(input, init)),
      { preconnect: () => {} },
    ),
  });
  const partials: number[] = [];
  try {
    const ready = await client.getSignTrack(videoId, "ASL", {
      pollIntervalMs: 1,
      timeoutMs: 2000,
      onPartial: (track) => {
        partials.push(track.segments.length);
        releaseFinal();
      },
    });
    expect(partials).toEqual([40]);
    expect(ready.status).toBe("ready");
    expect(ready.segments).toHaveLength(41);
    expect(SignTrackSchema.safeParse(ready).success).toBe(true);
    expect(providerCalls).toBeGreaterThan(0);
    const before = providerCalls;
    expect(await client.getSignTrack(videoId)).toEqual(ready);
    expect(providerCalls).toBe(before);
  } finally {
    releaseFinal();
    await jobs.wait(videoId, "ASL");
    cache.close();
  }
});
