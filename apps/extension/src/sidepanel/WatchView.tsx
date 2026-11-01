import { useEffect, useRef, useState } from "react";
import { createPlayer, type AvatarPlayer, type PlayerKind } from "../avatar/player";
import { createVideoSync } from "../avatar/sync";
import { SIGN_ASSETS_PATH } from "../config";
import { describeError } from "../errors";
import type { PageInfo } from "../messages";
import type { Settings } from "../settings";
import { createSignIndex, formatGloss } from "../track";
import { useRemoteState, useSignTrack } from "./hooks";
import type { RemoteVideo } from "./remote-video";
import { EmptyState, Icons } from "./ui";

interface WatchViewProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  page: PageInfo | null | undefined;
  remote: RemoteVideo;
}

/** The main view: what the active tab is playing, and the avatar signing it. */
export function WatchView({ settings, update, page, remote }: WatchViewProps) {
  if (page === undefined) return null; // connecting; takes a few ms
  if (page === null) {
    return (
      <EmptyState
        icon={<Icons.play />}
        title="Open a YouTube video"
        body="SignStream signs along with whatever you're watching."
      />
    );
  }
  if (!settings.enabled) {
    return (
      <EmptyState
        icon={<Icons.hand />}
        title="SignStream is off"
        body="Turn it on to see signs for this video."
        action={
          <button type="button" className="button primary" onClick={() => update({ enabled: true })}>
            Turn on
          </button>
        }
      />
    );
  }

  const { route } = page;
  if (route.kind === "shorts") {
    return <EmptyState icon={<Icons.play />} title="Shorts aren't supported yet" body="Open a regular video to see signs." />;
  }
  if (route.kind === "other") {
    return <EmptyState icon={<Icons.play />} title="Pick a video" body="Signs show up here as soon as you open one." />;
  }

  return (
    <>
      <NowWatching videoId={route.videoId} title={page.title} settings={settings} />
      {route.kind === "live" ? (
        <EmptyState icon={<Icons.alert />} title="Live streams aren't supported yet" body="Signing works on regular videos." />
      ) : (
        <Signer
          key={`${route.videoId}|${settings.lang}|${settings.useMockData}`}
          videoId={route.videoId}
          settings={settings}
          remote={remote}
        />
      )}
    </>
  );
}

function NowWatching({ videoId, title, settings }: { videoId: string; title: string; settings: Settings }) {
  return (
    <section className="card now-watching" aria-label="Now watching">
      <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} alt="" width="80" height="45" />
      <div className="now-watching-text">
        <span className="now-watching-title">{title || "YouTube video"}</span>
        <span className="meta">
          {settings.lang}
          {settings.useMockData ? " · Demo mode" : ""}
        </span>
      </div>
    </section>
  );
}

function Signer({ videoId, settings, remote }: { videoId: string; settings: Settings; remote: RemoteVideo }) {
  const [track, retry] = useSignTrack(videoId, settings.lang, String(settings.useMockData));
  const { paused, rate, ad } = useRemoteState(remote);
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AvatarPlayer>(undefined);
  const offsetRef = useRef(settings.offsetSec);
  const [kind, setKind] = useState<PlayerKind>();
  const [now, setNow] = useState({ gloss: "", caption: "" });

  useEffect(() => {
    offsetRef.current = settings.offsetSec;
  }, [settings.offsetSec]);

  // The player lives as long as this component (one video + language).
  useEffect(() => {
    const created = createPlayer(stageRef.current!, {
      lang: settings.lang,
      assetsBaseUrl: chrome.runtime.getURL(SIGN_ASSETS_PATH),
      showGloss: false,
    });
    playerRef.current = created.player;
    setKind(created.kind);
    return () => {
      created.player.destroy();
      playerRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lang` is part of this component's key
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (track.kind !== "ready" || !player) return;
    player.load(track.track);
    const index = createSignIndex(track.track);
    let last = "";
    const sync = createVideoSync({
      video: remote.asMedia(),
      player,
      getOffset: () => offsetRef.current,
      isSuspended: () => remote.adShowing,
      onTick: (t) => {
        const sign = index.signAt(t);
        const gloss = sign ? formatGloss(sign.gloss) : "";
        const caption = index.segmentAt(t)?.text ?? "";
        if (`${gloss}|${caption}` === last) return;
        last = `${gloss}|${caption}`;
        setNow({ gloss, caption });
      },
    });
    const onAdChange = () => sync.refresh();
    remote.addEventListener("adchange", onAdChange);
    return () => {
      remote.removeEventListener("adchange", onAdChange);
      sync.destroy();
    };
  }, [track, remote]);

  return (
    <>
      <div className="stage" ref={stageRef}>
        {track.kind === "loading" && (
          <div className="stage-overlay" role="status">
            <span className="overlay-title">
              Preparing signs…{track.progress !== undefined && ` ${Math.round(track.progress * 100)}%`}
            </span>
            <div className="progress" data-indeterminate={track.progress === undefined || undefined}>
              <div style={{ width: track.progress !== undefined ? `${Math.round(track.progress * 100)}%` : undefined }} />
            </div>
            {!settings.useMockData && <span className="meta">Translating with Cerebras</span>}
          </div>
        )}
        {track.kind === "error" && (
          <div className="stage-overlay" role="alert">
            <span className="overlay-icon">
              <Icons.alert />
            </span>
            <span className="overlay-title">{describeError(track.code)}</span>
            <button type="button" className="button secondary" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {track.kind === "ready" && ad && (
          <div className="stage-overlay" role="status">
            <span className="overlay-title">Ad playing</span>
            <span className="meta">Signing continues after the ad</span>
          </div>
        )}
      </div>

      {track.kind === "ready" && (
        <>
          {/* The placeholder already prints the gloss inside the stage; the avatar needs it spelled out below. */}
          {kind === "avatar" && settings.showGloss && (
            <div className="now-signing" aria-live="off">
              <span className="gloss">{now.gloss || " "}</span>
              <span className="caption">{now.caption || " "}</span>
            </div>
          )}
          <div className="status-bar">
            <span className="pill" data-state={ad ? "ad" : paused ? "paused" : "signing"}>
              <span className="dot" />
              {ad ? "Ad playing" : paused ? "Paused" : "Signing"}
              {!ad && rate !== 1 && <span className="rate">{rate}×</span>}
            </span>
            <span className="meta">
              {track.source === "api" && `Ready in ${track.seconds.toFixed(1)}s · Cerebras`}
              {track.source === "cache" && "Ready · cached"}
              {track.source === "mock" && "Demo track, not this video's speech"}
            </span>
          </div>
        </>
      )}
    </>
  );
}
