// Everything that depends on YouTube's page structure lives here, so a YouTube change is a one-file fix.
import type { Route } from "../messages";

export const SELECTORS = {
  video: "video.html5-main-video",
  moviePlayer: "#movie_player",
  rightControls: "#movie_player .ytp-right-controls",
  /** The time display gets `ytp-live` on live streams; the player itself on some layouts. */
  liveIndicator: "#movie_player.ytp-live, #movie_player .ytp-time-display.ytp-live",
} as const;

/** YouTube fires this on `document` after every SPA navigation (the URL changes without a reload). */
export const NAVIGATE_FINISH_EVENT = "yt-navigate-finish";

const VIDEO_ID = /^[\w-]{11}$/;

export function parseRoute(href: string): Route {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "other" };
  }
  if (url.hostname !== "www.youtube.com") return { kind: "other" };

  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v") ?? "";
    return VIDEO_ID.test(videoId) ? { kind: "watch", videoId } : { kind: "other" };
  }
  const [, section, id = ""] = url.pathname.split("/");
  if (section === "shorts") return { kind: "shorts" };
  if (section === "live" && VIDEO_ID.test(id)) return { kind: "live", videoId: id };
  return { kind: "other" };
}

/** Resolves with the first element matching `selector`, waiting for it to be added if needed. */
export function waitForElement<T extends Element>(
  selector: string,
  { root = document, signal }: { root?: ParentNode & Node; signal?: AbortSignal } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const found = root.querySelector<T>(selector);
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const el = root.querySelector<T>(selector);
      if (!el) return;
      observer.disconnect();
      resolve(el);
    });
    observer.observe(root, { childList: true, subtree: true });
    signal?.addEventListener(
      "abort",
      () => {
        observer.disconnect();
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export const isAdShowing = (moviePlayer: Element): boolean => moviePlayer.classList.contains("ad-showing");

export const isLiveStream = (doc: Document = document): boolean => doc.querySelector(SELECTORS.liveIndicator) !== null;

/** YouTube sets the `dark` attribute on <html> in dark theme. */
export const isDarkTheme = (doc: Document = document): boolean => doc.documentElement.hasAttribute("dark");

/**
 * YouTube can replace its <video> element without a navigation. Calls `onReplace` with the new element whenever
 * the player's main video changes, until `signal` aborts.
 */
export function watchVideoElement(
  moviePlayer: Element,
  current: HTMLVideoElement,
  onReplace: (video: HTMLVideoElement) => void,
  signal: AbortSignal,
): void {
  let video = current;
  const observer = new MutationObserver(() => {
    const next = moviePlayer.querySelector<HTMLVideoElement>(SELECTORS.video) ?? moviePlayer.ownerDocument.querySelector<HTMLVideoElement>(SELECTORS.video);
    if (!next || next === video) return;
    video = next;
    onReplace(next);
  });
  observer.observe(moviePlayer, { childList: true, subtree: true });
  signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}
