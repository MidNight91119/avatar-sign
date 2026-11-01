import type { SignLang, SignTrack } from "./contracts";
import { SIGN_TRACK_PORT, type SignTrackRequest, type SignTrackUpdate } from "./messages";

export interface TrackHandlers {
  onProgress(progress: number): void;
  onReady(track: SignTrack, source: "api" | "cache" | "mock"): void;
  onError(code: string): void;
}

/** Asks the background worker for a sign track. Returns a cancel function (call it when leaving the video). */
export type RequestTrack = (videoId: string, lang: SignLang, handlers: TrackHandlers) => () => void;

export const requestSignTrack: RequestTrack = (videoId, lang, handlers) => {
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: SIGN_TRACK_PORT });
  } catch {
    // The extension was reloaded or updated; this copy of the content script is orphaned.
    queueMicrotask(() => handlers.onError("EXTENSION_RELOADED"));
    return () => {};
  }

  let settled = false;
  const settle = () => {
    settled = true;
    port.disconnect();
  };

  port.onMessage.addListener((msg: SignTrackUpdate) => {
    if (settled) return;
    if (msg.type === "progress") {
      handlers.onProgress(msg.progress);
    } else if (msg.type === "ready") {
      settle();
      handlers.onReady(msg.track, msg.source);
    } else {
      settle();
      handlers.onError(msg.code);
    }
  });
  port.onDisconnect.addListener(() => {
    if (settled) return;
    settled = true;
    handlers.onError(chrome.runtime?.id ? "UNKNOWN" : "EXTENSION_RELOADED");
  });

  const request: SignTrackRequest = { type: "request", videoId, lang };
  port.postMessage(request);

  return () => {
    if (!settled) settle();
  };
};
