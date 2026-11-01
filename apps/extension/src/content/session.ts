import type { SignTrack } from "@signstream/shared";
import type { CreatePlayer } from "../avatar/player";
import { createVideoSync, type VideoSync } from "../avatar/sync";
import { describeError } from "../errors";
import type { Settings } from "../settings";
import { createSignIndex, formatGloss } from "../track";
import type { RequestTrack } from "../track-client";
import { createPanel, type PanelTheme } from "./panel";
import { SIZE_PRESETS, type PanelLayout } from "./panel-geometry";
import { isAdShowing, isDarkTheme, isLiveStream, SELECTORS, waitForElement, watchVideoElement } from "./youtube";

/** YouTube's fullscreen progress bar + control bar. The panel stays above them so they remain clickable. */
const FULLSCREEN_CONTROLS_HEIGHT = 80;

export interface SessionDeps {
  doc: Document;
  /** Read live, so the timing offset applies without a remount. */
  getSettings(): Settings;
  layout: PanelLayout;
  saveLayout(layout: PanelLayout): void;
  requestTrack: RequestTrack;
  createPlayer: CreatePlayer;
  assetsBaseUrl: string;
  onTurnOff(): void;
}

export interface WatchSession {
  /** Applies settings that don't need a new track: gloss strip and panel size. */
  applySettings(settings: Settings): void;
  destroy(): void;
}

/** Everything for one video: the panel, the player, the track request and the sync loop. `destroy` undoes all of it. */
export function startWatchSession(videoId: string, isLiveRoute: boolean, deps: SessionDeps): WatchSession {
  const { doc } = deps;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const cleanups: (() => void)[] = [];
  let settings = deps.getSettings();
  const theme = (): PanelTheme => (isDarkTheme(doc) ? "dark" : "light");
  let sync: VideoSync | undefined;
  // Minimized: nothing is visible, so the player stops rendering until the panel is restored.
  let minimized = deps.layout.minimized;

  const panel = createPanel({
    doc,
    layout: deps.layout,
    defaultWidth: SIZE_PRESETS[settings.size],
    theme: theme(),
    showGloss: settings.showGloss,
    onLayoutChange: (layout) => {
      deps.saveLayout(layout);
      if (layout.minimized === minimized) return;
      minimized = layout.minimized;
      sync?.refresh();
    },
    onClose: deps.onTurnOff,
  });
  const mountPanel = () => {
    if (signal.aborted) return;
    if (doc.fullscreenElement) panel.mount(doc.fullscreenElement, FULLSCREEN_CONTROLS_HEIGHT);
    else panel.mount(doc.body);
  };
  mountPanel();
  cleanups.push(() => panel.destroy());

  // The gloss strip is ours (learner mode), so the player's own gloss label stays off.
  const { player } = deps.createPlayer(panel.playerContainer, {
    lang: settings.lang,
    assetsBaseUrl: deps.assetsBaseUrl,
    showGloss: false,
  });
  cleanups.push(() => player.destroy());

  // In fullscreen only the fullscreen element's subtree is visible, so the panel moves inside it.
  doc.addEventListener("fullscreenchange", mountPanel, { signal });
  window.addEventListener("resize", () => panel.fitToViewport(), { signal });
  const themeObserver = new MutationObserver(() => panel.setTheme(theme()));
  themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ["dark"] });
  cleanups.push(() => themeObserver.disconnect());

  let index = createSignIndex({ segments: [] });

  /** First call starts the sync loop; later calls replace the track (partial snapshots, then the ready track). */
  const showTrack = (track: SignTrack, video: HTMLVideoElement, moviePlayer: Element) => {
    player.load(track);
    index = createSignIndex(track);
    if (sync) {
      sync.refresh();
      return;
    }

    let adShowing = isAdShowing(moviePlayer);
    const playback = createVideoSync({
      video,
      player,
      getOffset: () => deps.getSettings().offsetSec,
      isSuspended: () => adShowing || minimized,
      onTick: (t) => {
        const sign = index.signAt(t);
        panel.setGloss(sign ? formatGloss(sign.gloss) : "");
      },
    });
    sync = playback;
    cleanups.push(() => playback.destroy());
    watchVideoElement(moviePlayer, video, (next) => playback.setVideo(next), signal);

    const showAdState = () => {
      if (adShowing) panel.setGloss("");
      panel.setStatus(
        adShowing ? { kind: "paused", text: "Ad playing", sub: "Signing continues after the ad" } : { kind: "ready" },
      );
    };
    showAdState();

    // Ad time must not move the avatar: YouTube plays ads in the same <video> and marks the player with `ad-showing`.
    const adObserver = new MutationObserver(() => {
      if (isAdShowing(moviePlayer) === adShowing) return;
      adShowing = !adShowing;
      showAdState();
      playback.refresh();
    });
    adObserver.observe(moviePlayer, { attributes: true, attributeFilter: ["class"] });
    cleanups.push(() => adObserver.disconnect());
  };

  const connect = async () => {
    panel.setStatus({ kind: "loading", text: "Finding the video…" });
    let video: HTMLVideoElement;
    let moviePlayer: Element;
    try {
      [video, moviePlayer] = await Promise.all([
        waitForElement<HTMLVideoElement>(SELECTORS.video, { root: doc, signal }),
        waitForElement(SELECTORS.moviePlayer, { root: doc, signal }),
      ]);
    } catch {
      return; // destroyed while waiting
    }
    if (signal.aborted) return;
    if (isLiveStream(doc)) {
      panel.setStatus({ kind: "error", text: describeError("LIVE_NOT_SUPPORTED") });
      return;
    }

    const startedAt = performance.now();
    const elapsed = () => ((performance.now() - startedAt) / 1000).toFixed(1);
    panel.setStatus({ kind: "loading", text: "Preparing signs…" });

    let partial = false;
    const cancel = deps.requestTrack(videoId, settings.lang, {
      onProgress: (progress) => {
        const percent = `${Math.round(progress * 100)}%`;
        // Once part of the track plays, progress is a small note instead of covering the avatar.
        if (partial) panel.setNote(`Preparing more signs… ${percent}`);
        else
          panel.setStatus({
            kind: "loading",
            text: `Preparing signs… ${percent}`,
            sub: `Translating with Cerebras · ${elapsed()}s`,
            progress,
          });
      },
      onPartial: (track) => {
        partial = true;
        showTrack(track, video, moviePlayer);
        panel.setNote("Preparing more signs…");
      },
      onError: (code) => {
        panel.setNote("");
        panel.setStatus({ kind: "error", text: describeError(code) });
      },
      onReady: (track, source) => {
        panel.setNote("");
        showTrack(track, video, moviePlayer);
        if (source === "api") panel.toast(`Signed in ${elapsed()}s with Cerebras`);
        if (source === "mock") panel.toast("Demo track: not this video's speech");
      },
    });
    cleanups.push(cancel);
  };

  if (isLiveRoute) panel.setStatus({ kind: "error", text: describeError("LIVE_NOT_SUPPORTED") });
  else void connect();

  return {
    applySettings(next) {
      panel.setShowGloss(next.showGloss);
      if (next.size !== settings.size) panel.setWidth(SIZE_PRESETS[next.size]);
      settings = next;
    },
    destroy() {
      lifetime.abort();
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    },
  };
}
