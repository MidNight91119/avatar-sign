import type { SignLang, SignTrack } from "@signstream/shared";
import {
  SIGN_TRACK_PORT,
  SignTrackUpdateSchema,
  type SignTrackRequest,
  type TrackSource,
} from "./messages";

export interface TrackHandlers {
  onProgress(progress: number): void;
  /** A cumulative snapshot while processing: replace the current track with it (never append). */
  onPartial(track: SignTrack): void;
  onReady(track: SignTrack, source: TrackSource): void;
  onError(code: string): void;
}

/** Asks the background worker for a sign track. Returns a cancel function (call it when leaving the video). */
export type RequestTrack = (videoId: string, lang: SignLang, handlers: TrackHandlers) => () => void;

type PortLike = Pick<chrome.runtime.Port, "postMessage" | "disconnect" | "onMessage" | "onDisconnect">;

export interface TrackClientDeps {
  connect(name: string): PortLike;
  /** False once the extension has been reloaded and this script is orphaned. */
  isAlive(): boolean;
  reconnectDelayMs?: number;
  maxReconnects?: number;
}

const chromeDeps: TrackClientDeps = {
  connect: (name) => chrome.runtime.connect({ name }),
  isAlive: () => Boolean(chrome.runtime?.id),
};

/**
 * One port per request. If the port drops before an answer (the worker was suspended or restarted), it reconnects
 * and asks again: the worker starts from its session cache and the API resumes the same job (PLAN §11).
 * Updates are validated and must carry this request's id; anything else is ignored.
 */
export function createTrackClient(deps: TrackClientDeps = chromeDeps): RequestTrack {
  const { reconnectDelayMs = 500, maxReconnects = 3 } = deps;

  return (videoId, lang, handlers) => {
    const requestId = crypto.randomUUID();
    let port: PortLike | undefined;
    let settled = false;
    let reconnects = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      settled = true;
      clearTimeout(timer);
      port?.disconnect();
    };
    const fail = (code: string) => {
      finish();
      handlers.onError(code);
    };

    const open = () => {
      if (settled) return;
      if (!deps.isAlive()) return fail("EXTENSION_RELOADED");
      let current: PortLike;
      try {
        current = deps.connect(SIGN_TRACK_PORT);
      } catch {
        return fail("EXTENSION_RELOADED");
      }
      port = current;

      current.onMessage.addListener((msg: unknown) => {
        if (settled || port !== current) return;
        const parsed = SignTrackUpdateSchema.safeParse(msg);
        if (!parsed.success || parsed.data.requestId !== requestId) return;
        const update = parsed.data;
        if (update.type === "progress") {
          handlers.onProgress(update.progress);
        } else if (update.type === "partial") {
          handlers.onPartial(update.track);
        } else if (update.type === "ready") {
          finish();
          handlers.onReady(update.track, update.source);
        } else {
          fail(update.code);
        }
      });

      current.onDisconnect.addListener(() => {
        if (settled || port !== current) return;
        port = undefined;
        if (!deps.isAlive()) return fail("EXTENSION_RELOADED");
        if (reconnects >= maxReconnects) return fail("WORKER_LOST");
        reconnects++;
        timer = setTimeout(open, reconnectDelayMs);
      });

      const request: SignTrackRequest = { type: "request", requestId, videoId, lang };
      current.postMessage(request);
    };

    open();
    return () => {
      if (!settled) finish();
    };
  };
}

export const requestSignTrack: RequestTrack = (videoId, lang, handlers) =>
  createTrackClient()(videoId, lang, handlers);
