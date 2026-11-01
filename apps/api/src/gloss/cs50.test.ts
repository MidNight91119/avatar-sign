import { expect, it } from "bun:test";
import { CS50_VIDEOS, fetchCs50Corpus } from "./cs50";
import type { VideoSource } from "../transcript";
import { CaptionSchema } from "@signstream/shared";

function source(durationSec = 180): VideoSource {
  return {
    getDetails: async (videoId) => ({
      videoId,
      title: "CS50 test",
      description: "",
      durationSec,
      isLive: false,
      playable: true,
      tracks: [{ url: `https://example.com/${videoId}`, languageCode: "en" }],
    }),
    getTrack: async () => ({
      events: [
        { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "Hello CS50" }] },
      ],
    }),
  };
}

it("builds the selected five-video CS50 corpus through the shared transcript parser", async () => {
  const corpus = await fetchCs50Corpus(source());
  expect(corpus.source).toBe("youtube-captions");
  expect(corpus.videos.map(({ videoId }) => videoId)).toEqual(
    CS50_VIDEOS.map(({ videoId }) => videoId),
  );
  expect(new Set(corpus.videos.map(({ videoId }) => videoId)).size).toBe(5);
  expect(
    corpus.videos.every(
      ({ captions }) => CaptionSchema.array().safeParse(captions).success,
    ),
  ).toBe(true);
  expect(corpus.videos[0]?.url).toBe("https://youtu.be/Fc9htmvVZ9U");
  expect(corpus.attribution.license).toBe("CC BY-NC-SA 4.0");
});

it("rejects a selected video that exceeds the API duration limit", async () => {
  await expect(fetchCs50Corpus(source(901))).rejects.toThrow("15-minute");
});

it("does not replace unavailable real captions with invented data", async () => {
  await expect(
    fetchCs50Corpus({ ...source(), getTrack: async () => ({ events: [] }) }),
  ).rejects.toThrow("empty");
});
