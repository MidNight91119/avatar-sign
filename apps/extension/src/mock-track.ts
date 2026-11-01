import type { Segment, Sign, SignLang, SignTrack } from "./contracts";

// Until Raashed's mocks/sign-track.sample.json lands, this stands in for the API ("Use demo data"
// in the popup). It covers any video, so sync can be checked on whatever is playing.
const PHRASES: { text: string; glosses: string[]; nonManual?: Sign["nonManual"] }[] = [
  { text: "Hello, my name is Bob.", glosses: ["HELLO", "MY", "NAME", "FS:BOB"] },
  { text: "I am going to the store tomorrow.", glosses: ["TOMORROW", "STORE", "I", "GO"] },
  { text: "Do you want to learn sign language?", glosses: ["YOU", "WANT", "LEARN", "SIGN"], nonManual: "question" },
  { text: "I don't understand.", glosses: ["I", "UNDERSTAND", "NOT"], nonManual: "negation" },
  { text: "The weather is really nice today.", glosses: ["TODAY", "WEATHER", "NICE"], nonManual: "emphasis" },
  { text: "Thank you for watching.", glosses: ["THANK-YOU", "WATCH"] },
];

const SEGMENT_SEC = 4;
const GAP_SEC = 1;

export function buildMockTrack(videoId: string, lang: SignLang, durationSec = 3600): SignTrack {
  const segments: Segment[] = [];
  for (let i = 0, start = 0.5; start + SEGMENT_SEC <= durationSec; i++, start += SEGMENT_SEC + GAP_SEC) {
    const phrase = PHRASES[i % PHRASES.length]!;
    const slot = SEGMENT_SEC / phrase.glosses.length;
    segments.push({
      start,
      end: start + SEGMENT_SEC,
      text: phrase.text,
      signs: phrase.glosses.map((gloss, j) => ({
        gloss,
        start: start + j * slot,
        duration: slot * 0.85,
        ...(phrase.nonManual ? { nonManual: phrase.nonManual } : {}),
      })),
    });
  }
  return { videoId, lang, source: "manual", status: "ready", segments };
}
