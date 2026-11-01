import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi, YT_PLAYING, type YTPlayer } from "../lib/youtube-iframe";

/**
 * Mounts a YouTube player into `frame` and exposes its clock. `getTime` is stable and cheap: read it every
 * animation frame (the avatar does). `paused` is true unless the video is actually playing (buffering holds too).
 */
export function useYouTubePlayer(videoId: string) {
  const frame = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer>(undefined);
  const [paused, setPaused] = useState(true);
  const [rate, setRateState] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const host = frame.current;
    // YouTube replaces the element it's given, so give it a child React doesn't own.
    const el = document.createElement("div");
    host?.append(el);
    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player.current = new YT.Player(el, {
        videoId,
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e) => setPaused(e.data !== YT_PLAYING),
          onPlaybackRateChange: (e) => setRateState(e.data),
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = undefined;
      host?.replaceChildren();
    };
  }, [videoId]);

  const getTime = useCallback(() => player.current?.getCurrentTime?.(), []);
  const setRate = useCallback((r: number) => player.current?.setPlaybackRate?.(r), []);
  return { frame, getTime, paused, rate, setRate };
}
