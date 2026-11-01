import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SignLang, SignTrack } from "@signstream/shared";
import type { PageInfo, TrackSource } from "../messages";
import { loadSettings, normalizeSettings, onSettingsChanged, writeSettings, type Settings } from "../settings";
import { requestSignTrack } from "../track-client";
import { connectToActiveTab } from "./active-tab";
import { RemoteVideo } from "./remote-video";

/** Settings from chrome.storage.sync, kept live (Alt+S or the YouTube button can change them too). */
export function useSettings(): [Settings | undefined, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>();
  const current = useRef<Settings>(undefined);
  useEffect(() => {
    const receive = (next: Settings) => {
      current.current = next;
      setSettings(next);
    };
    void loadSettings().then(receive);
    return onSettingsChanged(receive);
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    if (!current.current) return;
    const next = normalizeSettings({ ...current.current, ...patch });
    current.current = next;
    setSettings(next);
    void writeSettings(next);
  }, []);
  return [settings, update];
}

/** What the active tab is showing (`null`: not YouTube), and its video as a RemoteVideo clock. */
export function useActiveTab(): { page: PageInfo | null | undefined; remote: RemoteVideo } {
  const remote = useMemo(() => new RemoteVideo(), []);
  const [page, setPage] = useState<PageInfo | null>();
  useEffect(
    () =>
      connectToActiveTab({
        onPage: (next) => {
          if (next === null) remote.reset();
          setPage((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        },
        onVideo: (snapshot) => remote.apply(snapshot),
      }),
    [remote],
  );
  return { page, remote };
}

const remoteState = (remote: RemoteVideo) => ({ paused: remote.paused, rate: remote.playbackRate, ad: remote.adShowing });

/** Re-renders when the remote video plays, pauses, changes speed or an ad starts/ends. */
export function useRemoteState(remote: RemoteVideo) {
  const [state, setState] = useState(() => remoteState(remote));
  useEffect(() => {
    const update = () => setState(remoteState(remote));
    const events = ["play", "pause", "ratechange", "adchange"];
    for (const type of events) remote.addEventListener(type, update);
    update();
    return () => events.forEach((type) => remote.removeEventListener(type, update));
  }, [remote]);
  return state;
}

export type TrackState =
  | { kind: "loading"; progress?: number; startedAt: number }
  | { kind: "ready"; track: SignTrack; source: TrackSource; seconds: number }
  | { kind: "error"; code: string };

/** Requests the sign track through the background worker (same cache as the in-page panel). */
export function useSignTrack(videoId: string, lang: SignLang, sourceKey: string): [TrackState, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TrackState>({ kind: "loading", startedAt: performance.now() });

  useEffect(() => {
    const startedAt = performance.now();
    setState({ kind: "loading", startedAt });
    return requestSignTrack(videoId, lang, {
      onProgress: (progress) => setState({ kind: "loading", progress, startedAt }),
      onReady: (track, source) =>
        setState({ kind: "ready", track, source, seconds: (performance.now() - startedAt) / 1000 }),
      onError: (code) => setState({ kind: "error", code }),
    });
  }, [videoId, lang, sourceKey, attempt]);

  return [state, () => setAttempt((n) => n + 1)];
}
