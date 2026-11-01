import type { SignLang, SignTrack } from "./contracts";
import type { Route } from "./content/youtube";

/** Port name for content script ↔ background worker. One port per video; disconnecting cancels the request. */
export const SIGN_TRACK_PORT = "sign-track";

export interface SignTrackRequest {
  type: "request";
  videoId: string;
  lang: SignLang;
}

export type SignTrackUpdate =
  | { type: "progress"; progress: number }
  | { type: "ready"; track: SignTrack; source: "api" | "cache" | "mock" }
  | { type: "error"; code: string };

/** Port name for side panel → content script of the active tab. The port closing means the side panel closed. */
export const SIDEPANEL_PORT = "sidepanel";

export interface PageInfo {
  route: Route;
  title: string;
}

/** The YouTube <video>'s state, sent on every media event and ~4×/s while playing (timeupdate). */
export interface VideoSnapshot {
  event: "sync" | "play" | "pause" | "seeked" | "ratechange";
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  adShowing: boolean;
  /** Date.now() when sent, to correct for message latency. */
  sentAt: number;
}

export type SidePanelUpdate = { type: "page"; page: PageInfo } | { type: "video"; video: VideoSnapshot };
