/**
 * Fetches timed captions for a YouTube video (spec §2).
 *
 * YouTube's WEB/MWEB/TV clients currently answer UNPLAYABLE with no caption tracks for server
 * requests, while the IOS and ANDROID clients return the track list, so we try those first.
 */
import { Innertube, Log } from "youtubei.js";
import type { Caption, SignTrackError } from "@signstream/shared";
import { normalizeCaptions, parseJson3 } from "./captions";

export class TranscriptError extends Error {
  readonly code: SignTrackError;
  constructor(code: SignTrackError, message: string) {
    super(message);
    this.name = "TranscriptError";
    this.code = code;
  }
}

export interface CaptionTrackInfo {
  url: string;
  languageCode: string;
  /** "asr" = auto-generated. */
  kind?: string;
}

export interface VideoDetails {
  videoId: string;
  title: string;
  description: string;
  durationSec: number;
  isLive: boolean;
  playable: boolean;
  tracks: CaptionTrackInfo[];
}

/** Where video details and caption files come from (YouTube in production, fakes in tests). */
export interface VideoSource {
  getDetails(videoId: string): Promise<VideoDetails>;
  /** Returns the parsed json3 body of a caption track. */
  getTrack(url: string): Promise<unknown>;
}

export interface Transcript {
  videoId: string;
  title: string;
  description: string;
  durationSec: number;
  captions: Caption[];
  /** Which track we used, for logs. */
  track: { languageCode: string; auto: boolean };
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Manual English first, then auto-generated English (spec §2). */
export function pickTrack(tracks: CaptionTrackInfo[]): CaptionTrackInfo | undefined {
  const en = tracks.filter((t) => t.languageCode === "en" || t.languageCode.startsWith("en-"));
  return en.find((t) => t.kind !== "asr") ?? en.find((t) => t.kind === "asr");
}

export async function getTranscript(videoId: string, source: VideoSource): Promise<Transcript> {
  if (!VIDEO_ID.test(videoId)) throw new TranscriptError("VIDEO_UNAVAILABLE", `Invalid YouTube video id: ${videoId}`);

  let details: VideoDetails;
  try {
    details = await source.getDetails(videoId);
  } catch (e) {
    throw new TranscriptError("VIDEO_UNAVAILABLE", `Could not load video ${videoId}: ${(e as Error).message}`);
  }
  if (details.isLive) throw new TranscriptError("LIVE_NOT_SUPPORTED", "Live streams are not supported");
  if (!details.playable && details.tracks.length === 0) {
    throw new TranscriptError("VIDEO_UNAVAILABLE", `Video ${videoId} is unavailable`);
  }

  const track = pickTrack(details.tracks);
  if (!track) throw new TranscriptError("NO_CAPTIONS", "This video has no English captions");

  const captions = normalizeCaptions(parseJson3(await source.getTrack(track.url)));
  if (captions.length === 0) throw new TranscriptError("NO_CAPTIONS", "The caption track is empty");

  return {
    videoId,
    title: details.title,
    description: details.description,
    durationSec: details.durationSec,
    captions,
    track: { languageCode: track.languageCode, auto: track.kind === "asr" },
  };
}

type ClientName = "IOS" | "ANDROID" | "WEB";

/** Production source backed by youtubei.js. */
export function youtubeSource(clients: ClientName[] = ["IOS", "ANDROID", "WEB"]): VideoSource {
  Log.setLevel(Log.Level.NONE);
  let yt: Promise<Innertube> | undefined;
  const client = () => (yt ??= Innertube.create({ retrieve_player: false }));

  return {
    async getDetails(videoId) {
      const innertube = await client();
      let last: VideoDetails | undefined;
      let lastError: unknown;
      for (const name of clients) {
        try {
          const info = await innertube.getBasicInfo(videoId, { client: name });
          const b = info.basic_info;
          last = {
            videoId,
            title: b.title ?? "",
            description: b.short_description ?? "",
            durationSec: b.duration ?? 0,
            isLive: Boolean(b.is_live || b.is_upcoming),
            playable: info.playability_status?.status === "OK",
            tracks: (info.captions?.caption_tracks ?? []).map((t) => ({
              url: t.base_url,
              languageCode: t.language_code,
              kind: t.kind,
            })),
          };
          if (last.playable && last.tracks.length > 0) return last;
        } catch (e) {
          lastError = e;
        }
      }
      if (last) return last;
      throw lastError instanceof Error ? lastError : new Error("No YouTube client could load the video");
    },

    async getTrack(url) {
      const u = new URL(url);
      u.searchParams.set("fmt", "json3");
      const res = await fetch(u);
      if (!res.ok) throw new TranscriptError("NO_CAPTIONS", `Caption download failed with HTTP ${res.status}`);
      return res.json();
    },
  };
}
