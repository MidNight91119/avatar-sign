import type { CreatePlayer } from "../avatar/player";
import type { Settings } from "../settings";
import type { RequestTrack } from "../track-client";
import { CONTROL_BUTTON_ID, createControlButton } from "./control-button";
import { PANEL_HOST_ID } from "./panel";
import type { PanelLayout } from "./panel-geometry";
import { startWatchSession, type WatchSession } from "./session";
import { pageInfo, startVideoReporter, type SidebarHub, type SidebarLink } from "./sidebar-link";
import { NAVIGATE_FINISH_EVENT, parseRoute } from "./youtube";

/** YouTube fires this when the title and other metadata of the new video are in place. */
const PAGE_DATA_EVENT = "yt-page-data-updated";

export interface AppDeps {
  doc: Document;
  win: Window;
  settings: {
    load(): Promise<Settings>;
    save(patch: Partial<Settings>): Promise<unknown>;
    subscribe(listener: (settings: Settings) => void): () => void;
  };
  layout: {
    load(): Promise<PanelLayout>;
    save(layout: PanelLayout): void;
  };
  sidebar: Pick<SidebarHub, "subscribe">;
  requestTrack: RequestTrack;
  createPlayer: CreatePlayer;
  assetsBaseUrl: string;
}

/**
 * The content script's root. YouTube is a single-page app, so after every navigation, settings change,
 * fullscreen change and side panel open/close, it works out what this tab should show:
 * - side panel open: the avatar lives there; this tab only reports the video's state to it
 * - otherwise (or in fullscreen, where Chrome hides the side panel): the floating panel on the page
 * Returns a function that removes everything.
 */
export async function startApp(deps: AppDeps): Promise<() => void> {
  const { doc, win } = deps;

  // Leftovers from an older copy of this script (the extension was reloaded while the tab stayed open).
  doc.getElementById(PANEL_HOST_ID)?.remove();
  doc.getElementById(CONTROL_BUTTON_ID)?.remove();

  let settings = await deps.settings.load();
  let layout = await deps.layout.load();
  let session: WatchSession | undefined;
  let sessionKey = "";
  let sidebar: SidebarLink | undefined;
  let reporter: { link: SidebarLink; videoId: string; stop: () => void } | undefined;
  let buttonWait: AbortController | undefined;

  const setEnabled = (enabled: boolean) => void deps.settings.save({ enabled });
  const button = createControlButton(() => setEnabled(!settings.enabled), doc);

  const postPage = () => sidebar?.post({ type: "page", page: pageInfo(doc, win.location.href) });

  const syncReporter = (videoId: string | undefined) => {
    if (reporter && reporter.link === sidebar && reporter.videoId === videoId) return;
    reporter?.stop();
    reporter = undefined;
    const link = sidebar;
    if (!link || !videoId) return;
    reporter = { link, videoId, stop: startVideoReporter(doc, (video) => link.post({ type: "video", video })) };
  };

  const render = () => {
    const route = parseRoute(win.location.href);
    const video = route.kind === "watch" || route.kind === "live" ? route : undefined;

    buttonWait?.abort();
    button.setEnabled(settings.enabled);
    if (video) {
      buttonWait = new AbortController();
      button.ensure(buttonWait.signal).catch(() => {});
    } else {
      button.remove();
    }

    postPage();
    syncReporter(video?.videoId);

    const showOverlay = video && settings.enabled && (!sidebar || doc.fullscreenElement);
    const key = showOverlay
      ? [video.videoId, video.kind, settings.lang, settings.useMockData].join("|")
      : "";
    if (key === sessionKey) {
      session?.applySettings(settings);
      return;
    }

    session?.destroy();
    session = undefined;
    sessionKey = key;
    if (!video || !key) return;

    session = startWatchSession(video.videoId, video.kind === "live", {
      doc,
      getSettings: () => settings,
      layout,
      saveLayout: (next) => {
        layout = next;
        deps.layout.save(next);
      },
      requestTrack: deps.requestTrack,
      createPlayer: deps.createPlayer,
      assetsBaseUrl: deps.assetsBaseUrl,
      onTurnOff: () => setEnabled(false),
    });
  };

  const listeners = new AbortController();
  doc.addEventListener(NAVIGATE_FINISH_EVENT, render, { signal: listeners.signal });
  doc.addEventListener("fullscreenchange", render, { signal: listeners.signal });
  doc.addEventListener(PAGE_DATA_EVENT, postPage, { signal: listeners.signal });
  const unsubscribeSettings = deps.settings.subscribe((next) => {
    settings = next;
    render();
  });
  const unsubscribeSidebar = deps.sidebar.subscribe((link) => {
    sidebar = link;
    link.onDisconnect(() => {
      if (sidebar !== link) return;
      sidebar = undefined;
      render();
    });
    render();
  });
  render();

  return () => {
    listeners.abort();
    unsubscribeSettings();
    unsubscribeSidebar();
    buttonWait?.abort();
    reporter?.stop();
    session?.destroy();
    button.remove();
  };
}
