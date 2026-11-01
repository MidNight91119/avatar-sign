import { afterEach, describe, expect, it } from "bun:test";
import { isAdShowing, isDarkTheme, isLiveStream, parseRoute, waitForElement } from "./youtube";

describe("parseRoute", () => {
  it("reads the videoId from watch pages", () => {
    expect(parseRoute("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ kind: "watch", videoId: "dQw4w9WgXcQ" });
    expect(parseRoute("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=42s")).toEqual({
      kind: "watch",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it("recognises Shorts and live URLs", () => {
    expect(parseRoute("https://www.youtube.com/shorts/abcdefghijk")).toEqual({ kind: "shorts" });
    expect(parseRoute("https://www.youtube.com/live/abcdefghijk")).toEqual({ kind: "live", videoId: "abcdefghijk" });
  });

  it("ignores everything else", () => {
    for (const href of [
      "https://www.youtube.com/",
      "https://www.youtube.com/results?search_query=asl",
      "https://www.youtube.com/@channel",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/watch?v=short",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
      "not a url",
    ]) {
      expect(parseRoute(href)).toEqual({ kind: "other" });
    }
  });
});

describe("page state", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute("dark");
  });

  it("detects ads from the player's ad-showing class", () => {
    const player = document.createElement("div");
    expect(isAdShowing(player)).toBe(false);
    player.classList.add("ad-showing");
    expect(isAdShowing(player)).toBe(true);
  });

  it("detects live streams", () => {
    document.body.innerHTML = `<div id="movie_player"><div class="ytp-time-display"></div></div>`;
    expect(isLiveStream()).toBe(false);
    document.querySelector(".ytp-time-display")!.classList.add("ytp-live");
    expect(isLiveStream()).toBe(true);
  });

  it("detects YouTube's dark theme", () => {
    expect(isDarkTheme()).toBe(false);
    document.documentElement.setAttribute("dark", "");
    expect(isDarkTheme()).toBe(true);
  });
});

describe("waitForElement", () => {
  afterEach(() => document.body.replaceChildren());

  it("resolves at once if the element exists", async () => {
    document.body.innerHTML = `<video class="html5-main-video"></video>`;
    const video = await waitForElement("video.html5-main-video");
    expect(video.tagName).toBe("VIDEO");
  });

  it("waits for the element to be added", async () => {
    const pending = waitForElement("#movie_player");
    setTimeout(() => {
      const el = document.createElement("div");
      el.id = "movie_player";
      document.body.append(el);
    }, 5);
    expect((await pending).id).toBe("movie_player");
  });

  it("rejects when aborted", async () => {
    const controller = new AbortController();
    const pending = waitForElement("#never", { signal: controller.signal });
    controller.abort(new Error("left the page"));
    await expect(pending).rejects.toThrow("left the page");
  });
});
