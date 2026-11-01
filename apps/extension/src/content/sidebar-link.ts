import type { PageInfo, SidePanelUpdate, VideoSnapshot } from "../messages";
import { isAdShowing, parseRoute, SELECTORS, waitForElement } from "./youtube";

/** The side panel's connection to this tab, as the content script sees it. */
export interface SidebarLink {
  post(update: SidePanelUpdate): void;
  onDisconnect(listener: () => void): void;
}

type LinkListener = (link: SidebarLink) => void;

/**
 * Holds the side panel's connection. The side panel can connect before the app has finished starting
 * (it awaits storage), so the current link is replayed to late subscribers.
 */
export function createSidebarHub() {
  let current: SidebarLink | undefined;
  const listeners = new Set<LinkListener>();
  return {
    accept(link: SidebarLink) {
      current = link;
      link.onDisconnect(() => {
        if (current === link) current = undefined;
      });
      for (const listener of listeners) listener(link);
    },
    subscribe(listener: LinkListener): () => void {
      listeners.add(listener);
      if (current) listener(current);
      return () => listeners.delete(listener);
    },
  };
}

export type SidebarHub = ReturnType<typeof createSidebarHub>;

/** Wraps a chrome.runtime.Port from the side panel. */
export function linkFromPort(port: chrome.runtime.Port): SidebarLink {
  let open = true;
  port.onDisconnect.addListener(() => (open = false));
  return {
    post(update) {
      if (open) port.postMessage(update);
    },
    onDisconnect(listener) {
      port.onDisconnect.addListener(() => listener());
    },
  };
}

export function pageInfo(doc: Document, href: string): PageInfo {
  // "(3) Some video - YouTube" → "Some video"
  const title = doc.title.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim();
  return { route: parseRoute(href), title };
}

const EVENTS: [keyof HTMLMediaElementEventMap, VideoSnapshot["event"]][] = [
  ["play", "play"],
  ["pause", "pause"],
  ["seeking", "seeked"],
  ["seeked", "seeked"],
  ["ratechange", "ratechange"],
  ["timeupdate", "sync"],
];

/** Streams the <video>'s state to the side panel, which runs the avatar on its own clock between updates. */
export function startVideoReporter(doc: Document, post: (snapshot: VideoSnapshot) => void): () => void {
  const lifetime = new AbortController();
  const { signal } = lifetime;

  void Promise.all([
    waitForElement<HTMLVideoElement>(SELECTORS.video, { root: doc, signal }),
    waitForElement(SELECTORS.moviePlayer, { root: doc, signal }),
  ])
    .then(([video, moviePlayer]) => {
      if (signal.aborted) return;
      let adShowing = isAdShowing(moviePlayer);
      const send = (event: VideoSnapshot["event"]) =>
        post({
          event,
          currentTime: video.currentTime,
          paused: video.paused,
          playbackRate: video.playbackRate,
          adShowing,
          sentAt: Date.now(),
        });

      for (const [type, event] of EVENTS) video.addEventListener(type, () => send(event), { signal });
      // YouTube toggles classes on the player constantly (hover, autohide); only an ad change matters.
      const observer = new MutationObserver(() => {
        if (isAdShowing(moviePlayer) === adShowing) return;
        adShowing = !adShowing;
        send("sync");
      });
      observer.observe(moviePlayer, { attributes: true, attributeFilter: ["class"] });
      signal.addEventListener("abort", () => observer.disconnect());
      send("sync");
    })
    .catch(() => {}); // stopped while waiting

  return () => lifetime.abort();
}
