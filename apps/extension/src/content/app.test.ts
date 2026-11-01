import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { CreatePlayer } from "../avatar/player";
import type { AvatarPlayer, SignLang } from "../contracts";
import type { SidePanelUpdate } from "../messages";
import { buildMockTrack } from "../mock-track";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "../settings";
import type { RequestTrack, TrackHandlers } from "../track-client";
import { startApp } from "./app";
import { CONTROL_BUTTON_ID } from "./control-button";
import { PANEL_HOST_ID } from "./panel";
import type { PanelLayout } from "./panel-geometry";
import { createSidebarHub } from "./sidebar-link";
import { NAVIGATE_FINISH_EVENT } from "./youtube";

const ids = ["AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC", "DDDDDDDDDDD", "EEEEEEEEEEE"] as const;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A fake YouTube watch page and fakes for everything the content script talks to. */
function harness(initial: Partial<Settings> = {}) {
  document.body.innerHTML = `
    <div id="movie_player">
      <div class="ytp-right-controls"><button class="ytp-settings-button"></button></div>
      <video class="html5-main-video"></video>
    </div>`;
  const video = document.querySelector("video")!;
  const moviePlayer = document.querySelector("#movie_player")!;

  // Count live listeners on the <video>, to catch leaks across navigations.
  const live = new Set<{ signal?: AbortSignal }>();
  const add = video.addEventListener.bind(video);
  video.addEventListener = ((type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    const entry = { signal: opts?.signal };
    live.add(entry);
    opts?.signal?.addEventListener("abort", () => live.delete(entry));
    add(type, fn, opts);
  }) as typeof video.addEventListener;

  let settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...initial });
  const subscribers = new Set<(s: Settings) => void>();
  const layouts: PanelLayout[] = [];

  const requests: { videoId: string; lang: SignLang; handlers: TrackHandlers; cancelled: boolean }[] = [];
  const requestTrack: RequestTrack = (videoId, lang, handlers) => {
    const request = { videoId, lang, handlers, cancelled: false };
    requests.push(request);
    return () => void (request.cancelled = true);
  };

  const players: { ticks: number[]; destroyed: boolean }[] = [];
  const createPlayer: CreatePlayer = () => {
    const record = { ticks: [] as number[], destroyed: false };
    players.push(record);
    const player: AvatarPlayer = {
      load() {},
      tick: (t) => void record.ticks.push(t),
      setSpeed() {},
      play() {},
      pause() {},
      playSign() {},
      destroy: () => void (record.destroyed = true),
    };
    return { player, kind: "placeholder" };
  };

  const navigate = async (path: string) => {
    history.pushState({}, "", path);
    document.dispatchEvent(new Event(NAVIGATE_FINISH_EVENT));
    await settle();
  };

  const changeSettings = async (patch: Partial<Settings>) => {
    settings = normalizeSettings({ ...settings, ...patch });
    for (const fn of subscribers) fn(settings);
    await settle();
  };

  const start = () =>
    startApp({
      doc: document,
      win: window,
      settings: {
        load: async () => settings,
        save: async (patch) => changeSettings(patch),
        subscribe: (fn) => {
          subscribers.add(fn);
          return () => subscribers.delete(fn);
        },
      },
      layout: { load: async () => ({ minimized: false }), save: (l) => void layouts.push(l) },
      sidebar: hub,
      requestTrack,
      createPlayer,
      assetsBaseUrl: "chrome-extension://test/sign-assets/",
    });

  // A fake side panel connection.
  const hub = createSidebarHub();
  const openSidebar = async () => {
    const posts: SidePanelUpdate[] = [];
    const onClose = new Set<() => void>();
    hub.accept({ post: (u) => void posts.push(u), onDisconnect: (fn) => void onClose.add(fn) });
    await settle();
    return {
      posts,
      close: async () => {
        for (const fn of onClose) fn();
        await settle();
      },
    };
  };

  const setFullscreen = async (el: Element | null) => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => el });
    document.dispatchEvent(new Event("fullscreenchange"));
    await settle();
  };

  const shadow = () => document.getElementById(PANEL_HOST_ID)?.shadowRoot ?? undefined;
  return {
    video,
    moviePlayer,
    live,
    requests,
    players,
    navigate,
    changeSettings,
    start,
    shadow,
    layouts,
    openSidebar,
    setFullscreen,
  };
}

let stop: (() => void) | undefined;
beforeEach(() => history.pushState({}, "", `/watch?v=${ids[0]}`));
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.replaceChildren();
  Reflect.deleteProperty(document, "fullscreenElement");
});

describe("content script app", () => {
  it("mounts a panel and requests the track for the current video", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    expect(document.querySelectorAll(`#${PANEL_HOST_ID}`).length).toBe(1);
    expect(h.requests.map((r) => [r.videoId, r.lang])).toEqual([[ids[0], "ASL"]]);
    expect(h.shadow()?.querySelector(".status-text")?.textContent).toBe("Preparing signs…");
  });

  it("adds the SignStream toggle to the control bar, before YouTube's buttons", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    const controls = document.querySelector(".ytp-right-controls")!;
    expect(controls.firstElementChild?.id).toBe(CONTROL_BUTTON_ID);
    expect(controls.firstElementChild?.getAttribute("aria-pressed")).toBe("true");
  });

  it("remounts on each SPA navigation with one panel, one button and no leaked listeners", async () => {
    const h = harness();
    stop = await h.start();
    await settle();

    for (let i = 1; i <= 10; i++) await h.navigate(`/watch?v=${ids[i % ids.length]}`);

    expect(document.querySelectorAll(`#${PANEL_HOST_ID}`).length).toBe(1);
    expect(document.querySelectorAll(`#${CONTROL_BUTTON_ID}`).length).toBe(1);
    expect(h.requests.length).toBe(11);
    expect(h.requests.slice(0, -1).every((r) => r.cancelled)).toBe(true);
    expect(h.requests.at(-1)?.videoId).toBe(ids[10 % ids.length]);
    expect(h.players.filter((p) => !p.destroyed).length).toBe(1);

    // Play the current video's track: exactly one set of <video> listeners (play, pause, seeking, seeked, ratechange).
    h.requests.at(-1)!.handlers.onReady(buildMockTrack(ids[0], "ASL", 60), "cache");
    expect(h.live.size).toBe(5);
  });

  it("doesn't remount when YouTube re-fires navigation for the same video", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    await h.navigate(`/watch?v=${ids[0]}&t=30s`);
    expect(h.requests.length).toBe(1);
    expect(h.players.length).toBe(1);
  });

  it("skips Shorts and other pages", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    await h.navigate("/shorts/abcdefghijk");
    expect(document.getElementById(PANEL_HOST_ID)).toBeNull();
    expect(document.getElementById(CONTROL_BUTTON_ID)).toBeNull();
    expect(h.players.every((p) => p.destroyed)).toBe(true);
    await h.navigate("/");
    expect(document.getElementById(PANEL_HOST_ID)).toBeNull();
  });

  it("shows 'not supported' for live streams without calling the API", async () => {
    const h = harness();
    history.pushState({}, "", "/live/abcdefghijk");
    stop = await h.start();
    await settle();
    expect(h.requests.length).toBe(0);
    expect(h.shadow()?.querySelector(".status-text")?.textContent).toBe("Live streams aren't supported yet");
  });

  it("shows the API's error message", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    h.requests[0]!.handlers.onError("NO_CAPTIONS");
    expect(h.shadow()?.querySelector(".status-text")?.textContent).toBe("No captions available for this video");
  });

  it("turns off and on from the control bar button without a reload", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    const button = document.getElementById(CONTROL_BUTTON_ID)!;

    button.click();
    await settle();
    expect(document.getElementById(PANEL_HOST_ID)).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(h.live.size).toBe(0);

    button.click();
    await settle();
    expect(document.getElementById(PANEL_HOST_ID)).not.toBeNull();
    expect(h.requests.length).toBe(2);
  });

  it("applies popup settings live: offset, gloss strip, and language (which refetches)", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    h.requests[0]!.handlers.onReady(buildMockTrack(ids[0], "ASL", 60), "cache");

    await h.changeSettings({ showGloss: false });
    expect(h.shadow()?.querySelector<HTMLElement>(".gloss")?.hidden).toBe(true);
    expect(h.requests.length).toBe(1);

    await h.changeSettings({ lang: "ISL" });
    expect(h.requests.length).toBe(2);
    expect(h.requests[1]!.lang).toBe("ISL");
    expect(h.requests[0]!.cancelled).toBe(true);
  });

  it("pauses the avatar during ads and resumes after", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    h.requests[0]!.handlers.onReady(buildMockTrack(ids[0], "ASL", 60), "cache");
    const player = h.players[0]!;

    h.moviePlayer.classList.add("ad-showing");
    await settle();
    expect(h.shadow()?.querySelector(".status-text")?.textContent).toBe("Ad playing");
    const ticksDuringAd = player.ticks.length;
    h.video.dispatchEvent(new Event("seeked"));
    expect(player.ticks.length).toBe(ticksDuringAd);

    h.moviePlayer.classList.remove("ad-showing");
    await settle();
    expect(h.shadow()?.querySelector<HTMLElement>(".status")?.hidden).toBe(true);
    expect(player.ticks.length).toBeGreaterThan(ticksDuringAd);
  });

  it("cleans up everything when stopped", async () => {
    const h = harness();
    stop = await h.start();
    await settle();
    h.requests[0]!.handlers.onReady(buildMockTrack(ids[0], "ASL", 60), "cache");
    stop();
    stop = undefined;
    expect(document.getElementById(PANEL_HOST_ID)).toBeNull();
    expect(document.getElementById(CONTROL_BUTTON_ID)).toBeNull();
    expect(h.live.size).toBe(0);
    expect(h.players.every((p) => p.destroyed)).toBe(true);
  });

  describe("with the side panel open", () => {
    it("moves the avatar to the side panel: the floating panel goes away and the page reports to the side panel", async () => {
      const h = harness();
      stop = await h.start();
      await settle();
      expect(document.getElementById(PANEL_HOST_ID)).not.toBeNull();

      const sidebar = await h.openSidebar();
      expect(document.getElementById(PANEL_HOST_ID)).toBeNull();
      expect(h.requests[0]!.cancelled).toBe(true);
      // The ✋ toggle stays in the control bar.
      expect(document.getElementById(CONTROL_BUTTON_ID)).not.toBeNull();

      const page = sidebar.posts.find((u) => u.type === "page");
      expect(page?.type === "page" && page.page.route).toEqual({ kind: "watch", videoId: ids[0] });

      h.video.currentTime = 42;
      h.video.dispatchEvent(new Event("seeked"));
      const last = sidebar.posts.at(-1);
      expect(last?.type === "video" && last.video).toMatchObject({ event: "seeked", currentTime: 42, adShowing: false });
    });

    it("tells the side panel about navigations and ads", async () => {
      const h = harness();
      stop = await h.start();
      const sidebar = await h.openSidebar();

      await h.navigate(`/watch?v=${ids[1]}`);
      const pages = sidebar.posts.flatMap((u) => (u.type === "page" ? [u.page.route] : []));
      expect(pages.at(-1)).toEqual({ kind: "watch", videoId: ids[1] });

      h.moviePlayer.classList.add("ad-showing");
      await settle();
      const last = sidebar.posts.at(-1);
      expect(last?.type === "video" && last.video.adShowing).toBe(true);
    });

    it("brings the floating panel back in fullscreen (Chrome hides the side panel there) and when the side panel closes", async () => {
      const h = harness();
      stop = await h.start();
      const sidebar = await h.openSidebar();
      expect(document.getElementById(PANEL_HOST_ID)).toBeNull();

      await h.setFullscreen(h.moviePlayer);
      expect(document.getElementById(PANEL_HOST_ID)?.parentElement).toBe(h.moviePlayer as HTMLElement);
      await h.setFullscreen(null);
      expect(document.getElementById(PANEL_HOST_ID)).toBeNull();

      await sidebar.close();
      expect(document.getElementById(PANEL_HOST_ID)).not.toBeNull();
    });

    it("stops reporting when the side panel closes", async () => {
      const h = harness();
      stop = await h.start();
      const sidebar = await h.openSidebar();
      await sidebar.close();
      const count = sidebar.posts.length;
      h.video.dispatchEvent(new Event("play"));
      expect(sidebar.posts.length).toBe(count);
    });
  });
});
