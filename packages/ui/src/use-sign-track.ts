import { useEffect, useState } from "react";
import { ApiClientError, type ApiClient, type SignLang, type SignTrack } from "@signstream/shared";

export interface TrackState {
  /** Latest snapshot: partial while processing, then the ready track. */
  track?: SignTrack;
  /** 0–1 while processing. */
  progress?: number;
  /** SignTrack error code, client error code, or "NETWORK". */
  error?: string;
}

/**
 * Loads the sign track for `videoId` (nothing when it's empty). Partial snapshots replace each
 * other (PLAN §11.7). Changing the video or language cancels the old request and ignores its
 * late results, so the previous video's signs never show.
 */
export function useSignTrack(api: ApiClient, videoId: string | null | undefined, lang: SignLang): TrackState {
  const key = videoId ? `${videoId}|${lang}` : "";
  const [state, setState] = useState<TrackState & { key: string }>({ key: "" });

  useEffect(() => {
    if (!videoId) return;
    const ctrl = new AbortController();
    const set = (next: (s: TrackState) => TrackState) =>
      !ctrl.signal.aborted && setState((s) => ({ ...next(s.key === key ? s : {}), key }));
    api
      .getSignTrack(videoId, lang, {
        signal: ctrl.signal,
        onProgress: (progress) => set((s) => ({ ...s, progress })),
        onPartial: (track) => set((s) => ({ ...s, track })),
      })
      .then(
        (track) => set(() => (track.status === "error" ? { error: track.error ?? "INTERNAL" } : { track, progress: 1 })),
        (e: unknown) => set(() => ({ error: e instanceof ApiClientError ? e.code : "NETWORK" })),
      );
    return () => ctrl.abort();
  }, [api, key, videoId, lang]);

  if (!videoId) return {};
  return state.key === key ? state : { progress: 0 };
}
