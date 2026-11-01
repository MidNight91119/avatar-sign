"use client";

import { useEffect, useRef, useState } from "react";
import { SIGN_LANGS, type SignLang } from "@signstream/shared";
import { captionAt, nextSpeed, trackErrorMessage } from "@repo/ui/caption";
import { SignPanel } from "@repo/ui/sign-panel";
import { useSignTrack } from "@repo/ui/use-sign-track";
import { api, apiUrl } from "../../lib/api";

/** The parts of the YouTube IFrame API we use (https://developers.google.com/youtube/iframe_api_reference). */
interface YTPlayer {
  getCurrentTime?(): number;
  setPlaybackRate?(rate: number): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: { videoId: string; playerVars?: Record<string, number>; events?: { onPlaybackRateChange?: (e: { data: number }) => void } },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApi: Promise<YTNamespace> | undefined;
function loadYouTubeApi(): Promise<YTNamespace> {
  ytApi ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return ytApi;
}

/** Media time is polled 5×/s for the caption UI; the real player will read it per frame without React (H-I8). */
const POLL_MS = 200;

export function WatchView({ videoId }: { videoId: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer>(undefined);
  const [lang, setLang] = useState<SignLang>("ASL");
  const [signing, setSigning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const { track, progress, error } = useSignTrack(api, videoId, lang);

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
        events: { onPlaybackRateChange: (e) => setSpeed(e.data) },
      });
    });
    const poll = setInterval(() => {
      const t = player.current?.getCurrentTime?.();
      if (typeof t === "number") setTime(t);
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
      player.current?.destroy();
      player.current = undefined;
      host?.replaceChildren();
    };
  }, [videoId]);

  const pct = Math.round((progress ?? 0) * 100);
  const mode = signing && track ? "signing" : "idle";

  return (
    <div className="watch">
      <div className="watch-video">
        <div ref={frame} className="watch-frame" />
        {apiUrl ? null : (
          <p className="watch-note">
            Demo mode: the API isn&apos;t connected, so the avatar follows the sample volcano track instead of this video&apos;s
            captions.
          </p>
        )}
      </div>
      <div className="watch-panel">
        <SignPanel
          mode={mode}
          logoSrc="/brand/hand.png"
          langs={SIGN_LANGS}
          lang={lang}
          onLang={(l) => setLang(l as SignLang)}
          speed={speed}
          onSpeed={() => player.current?.setPlaybackRate?.(nextSpeed(speed))}
          head={error ? "Can't sign this video." : track ? "Ready to sign." : `Preparing signs… ${pct}%`}
          sub={
            error
              ? trackErrorMessage(error)
              : track
                ? "Press start. Every sentence gets signed beside the video."
                : "Turning the captions into sign language."
          }
          sourceLabel={error ? "Couldn't prepare signs" : track ? `Signing in ${lang}` : `Preparing… ${pct}%`}
          sourceDetail={`youtube.com/watch?v=${videoId}`}
          caption={captionAt(track, time)}
          time={time}
          onToggle={track ? () => setSigning(!signing) : undefined}
        />
      </div>
    </div>
  );
}
