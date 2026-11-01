import { describe, expect, it } from "bun:test";
import { TranscriptError, getTranscript, pickTrack, type VideoDetails, type VideoSource } from "./transcript";

const ID = "abcdefghijk";

function fakeSource(details: Partial<VideoDetails>, track: unknown = { events: [] }): VideoSource & { trackUrls: string[] } {
  const trackUrls: string[] = [];
  return {
    trackUrls,
    async getDetails(videoId) {
      return { videoId, title: "Volcanoes", description: "A lesson", durationSec: 180, isLive: false, playable: true, tracks: [], ...details };
    },
    async getTrack(url) {
      trackUrls.push(url);
      return track;
    },
  };
}

const json3 = {
  events: [
    { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: "Hello everyone" }] },
    { tStartMs: 2000, dDurationMs: 2500, segs: [{ utf8: "today we learn about volcanoes" }] },
  ],
};

const errorCode = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as TranscriptError).code;

describe("pickTrack", () => {
  it("prefers manual English over auto-generated", () => {
    const t = pickTrack([
      { url: "asr", languageCode: "en", kind: "asr" },
      { url: "de", languageCode: "de" },
      { url: "manual", languageCode: "en-GB" },
    ]);
    expect(t?.url).toBe("manual");
  });
  it("falls back to auto-generated English, and ignores other languages", () => {
    expect(pickTrack([{ url: "asr", languageCode: "en", kind: "asr" }])?.url).toBe("asr");
    expect(pickTrack([{ url: "de", languageCode: "de" }])).toBeUndefined();
  });
});

describe("getTranscript", () => {
  it("returns sorted, normalised captions with video details", async () => {
    const source = fakeSource({ tracks: [{ url: "https://yt/track", languageCode: "en" }] }, json3);
    const t = await getTranscript(ID, source);
    expect(t.title).toBe("Volcanoes");
    expect(t.durationSec).toBe(180);
    expect(t.track).toEqual({ languageCode: "en", auto: false });
    expect(t.captions).toEqual([
      { start: 0, end: 2, text: "Hello everyone" },
      { start: 2, end: 4.5, text: "today we learn about volcanoes" },
    ]);
    expect(source.trackUrls).toEqual(["https://yt/track"]);
  });

  it("gives NO_CAPTIONS when there is no English track, instead of crashing", async () => {
    expect(await errorCode(getTranscript(ID, fakeSource({ tracks: [{ url: "x", languageCode: "fr" }] })))).toBe("NO_CAPTIONS");
    expect(await errorCode(getTranscript(ID, fakeSource({ tracks: [] })))).toBe("NO_CAPTIONS");
  });

  it("gives NO_CAPTIONS when the track is empty", async () => {
    const source = fakeSource({ tracks: [{ url: "x", languageCode: "en" }] }, { events: [{ tStartMs: 0, segs: [{ utf8: "[Music]" }] }] });
    expect(await errorCode(getTranscript(ID, source))).toBe("NO_CAPTIONS");
  });

  it("gives LIVE_NOT_SUPPORTED for live streams", async () => {
    expect(await errorCode(getTranscript(ID, fakeSource({ isLive: true })))).toBe("LIVE_NOT_SUPPORTED");
  });

  it("gives VIDEO_UNAVAILABLE for bad ids, unplayable videos and load errors", async () => {
    expect(await errorCode(getTranscript("not a valid id", fakeSource({})))).toBe("VIDEO_UNAVAILABLE");
    expect(await errorCode(getTranscript(ID, fakeSource({ playable: false })))).toBe("VIDEO_UNAVAILABLE");
    const failing: VideoSource = {
      getDetails: async () => {
        throw new Error("network down");
      },
      getTrack: async () => ({}),
    };
    expect(await errorCode(getTranscript(ID, failing))).toBe("VIDEO_UNAVAILABLE");
  });
});
