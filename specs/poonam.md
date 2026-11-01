# Poonam: Browser Extension

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.3, §4.4

**Branch:** `poonam/extension`

## What you own
`apps/extension`: a Chrome Manifest V3 extension that adds the signing avatar to YouTube watch pages, in sync with the video.

## Stack
- Vite + `@crxjs/vite-plugin` + TypeScript
- React for the popup only; the content script uses plain TS + Shadow DOM
- `@signstream/player` (from Hasan) and the API client from `packages/shared` (from Raashed)
- `chrome.storage.sync` for settings

## Architecture

```
manifest.json
├── content script  (matches https://www.youtube.com/*)
│     ├── detects videoId and SPA navigation
│     ├── mounts the floating panel (Shadow DOM) → createAvatarPlayer()
│     ├── fetches the SignTrack (through the background worker) → player.load()
│     └── rAF loop: player.tick(video.currentTime)
├── background service worker
│     └── does the API fetch (avoids CORS problems on youtube.com), caches the track in chrome.storage.session
└── popup (React)
      └── settings: on/off, panel size, timing offset, show gloss, language
```

## Key details
- **YouTube is a single-page app.** The URL changes without a page reload. Listen for the `yt-navigate-finish` event on `document` and read `videoId` from `new URL(location.href).searchParams.get("v")`. Unmount and remount the panel on every new video, and **clean up all listeners** so nothing leaks.
- **Find the video:** `document.querySelector("video.html5-main-video")`. Retry with a `MutationObserver` until it appears.
- **Sync:** use a `requestAnimationFrame` loop that calls `player.tick(video.currentTime + offset)`. Also listen to `play`, `pause`, `seeking`, `seeked` and `ratechange` → `player.play()`, `player.pause()`, `player.setSpeed(video.playbackRate)`.
- **Ads:** while `.ad-showing` is on `#movie_player`, hide the panel or pause it. Ad time must not move the avatar.
- **Shadow DOM:** mount the panel inside `attachShadow({ mode: "open" })` so YouTube's CSS and ours can't interfere with each other.
- **Fullscreen:** when `document.fullscreenElement` is set, move the panel inside `#movie_player` so it stays visible.
- **Assets:** list the player's clip/model files in `web_accessible_resources`, and pass `assetsBaseUrl: chrome.runtime.getURL("assets/")` to the player.

## Tasks

| # | Task | Target hour |
|---|---|---|
| P1 | Scaffold MV3 + CRXJS; the content script logs the `videoId`; load unpacked works | 1.5 |
| P2 | SPA navigation handling + finding the `<video>` element + cleanup; test it by clicking through 5 videos in a row | 4 |
| P3 | Floating panel in Shadow DOM: drag, resize, minimize, snap to corners, position saved | 6 ✅ checkpoint 1 (with a placeholder box if the player isn't ready) |
| P4 | Add Hasan's player + the mock track; rAF sync loop + video events | 8 |
| P5 | Background worker fetch from the real API + polling while `processing` + loading UI ("Preparing signs… 40%") + error UI ("No captions available for this video") | 11 |
| P6 | "SignStream" toggle button injected into the YouTube control bar (`.ytp-right-controls`) | 13 |
| P7 | Popup settings (React): on/off, size S/M/L, timing offset (−1s to +1s), show gloss, language | 15 |
| P8 | Edge cases: ads, fullscreen, theater mode, Shorts (skip them), live streams (show "not supported"), dark/light theme | 17 |
| P9 | Production build → `signstream-extension.zip` for the GitHub release; record the GIF and screenshots for Ayush's website pages | 17 |

## Handoffs
- **Needs from Hasan:** the player package by hour 6 (until then, use a placeholder `<div>` that prints the current gloss as text; this tests the sync on its own).
- **Needs from Raashed:** the API client + the mock (hour 1), the deployed API URL (hour ~10).
- **Gives Ayush:** the GIF and screenshots for the website `/` and `/extension` pages (hour 17).
- **Gives Ayush:** the `.zip`, and an installed and tested build on the demo laptop (hour 19).

## Stretch
- Keyboard shortcut Alt+S (`commands` in the manifest)
- Learner mode: show the gloss text under the avatar
- Firefox build (the `webextension-polyfill`)
- Popup "Find signed videos" search box that calls `/api/discover` (**Exa**) and opens the result on YouTube with SignStream on
- While a new video is processing, show "Translating with Cerebras…" with the time taken, so the speed is visible

## Definition of done
- [ ] Works on all 5 demo videos, and when you navigate between them without reloading
- [ ] The avatar stays within ~0.5s of the speech through pause, seek, 0.5×–2× speed and fullscreen
- [ ] No console errors on YouTube; no leaked listeners after 10 navigations
- [ ] The `.zip` installs on a clean Chrome profile

## Demo role
You run the **live extension demo** (about 60s): open a YouTube video → turn on SignStream → the avatar signs → pause, seek, 1.5× speed → the avatar follows.
