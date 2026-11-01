# Poonam: Browser Extension

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.3, §4.4

**Branch:** `poonam/extension`

> **2026-11-01 refresh:** Reconcile your latest branch with the [PLAN §10 baseline](../PLAN.md#10-implementation-baseline-and-next-gates), then follow the **Current integration work for your agent** section below. Original hour targets are historical; retain completed work and attach evidence for new acceptance tasks.

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
│     └── does bounded API fetches with host permissions, caches snapshots in chrome.storage.session; polling survives worker suspension
└── popup (React)
      └── settings: on/off, panel size, timing offset, show gloss, language
```

## Key details

- **YouTube is a single-page app.** The URL changes without a page reload. Treat `yt-navigate-finish` as a YouTube-specific hint, with URL/video-element change detection as a tested fallback, and read `videoId` from `new URL(location.href).searchParams.get("v")`. Unmount and remount the panel on every new video, and **clean up all listeners** so nothing leaks.
- **Find the video:** `document.querySelector("video.html5-main-video")`. Retry with a `MutationObserver` until it appears.
- **Sync:** use a `requestAnimationFrame` loop that calls `player.tick(video.currentTime + offset)`. Forward play/pause/rate state through `player.play()`, `player.pause()` and `player.setSpeed(video.playbackRate)`. Re-sample the current timestamp on seeking/seeked and visibility return; do not multiply it by playbackRate. Freeze/hide during buffering and ads.
- **Ads:** while `.ad-showing` is on `#movie_player`, hide the panel or pause it. Ad time must not move the avatar.
- **Shadow DOM:** mount the panel inside `attachShadow({ mode: "open" })` so YouTube's CSS and ours can't interfere with each other.
- **Fullscreen:** when `document.fullscreenElement` is set, move the panel inside `#movie_player` so it stays visible.
- **Assets:** list the player's clip/model files in `web_accessible_resources`, and pass `assetsBaseUrl: chrome.runtime.getURL("assets/")` to the player.

## Tasks

| #   | Task                                                                                                                                                             | Target hour                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P1  | Scaffold MV3 + CRXJS; the content script logs the `videoId`; load unpacked works                                                                                 | 1.5                                                                  |
| P2  | SPA navigation handling + finding the `<video>` element + cleanup; test it by clicking through 5 videos in a row                                                 | 4                                                                    |
| P3  | Floating panel in Shadow DOM: drag, resize, minimize, snap to corners, position saved                                                                            | 6 ✅ checkpoint 1 (with a placeholder box if the player isn't ready) |
| P4  | Add Hasan's player + the mock track; rAF sync loop + video events                                                                                                | 8                                                                    |
| P5  | Background worker fetch from the real API + polling while `processing` + loading UI ("Preparing signs… 40%") + error UI ("No captions available for this video") | 11                                                                   |
| P6  | "SignStream" toggle button injected into the YouTube control bar (`.ytp-right-controls`)                                                                         | 13                                                                   |
| P7  | Popup settings (React): on/off, size S/M/L, timing offset (−1s to +1s), show gloss, language                                                                     | 15                                                                   |
| P8  | Edge cases: ads, fullscreen, theater mode, Shorts (skip them), live streams (show "not supported"), dark/light theme                                             | 17                                                                   |
| P9  | Production build → `signstream-extension.zip` for the GitHub release; record the GIF and screenshots for Ayush's website pages                                   | 17                                                                   |

## Handoffs

- **Needs from Hasan:** the player package by hour 6 (until then, use a placeholder `<div>` that prints the current gloss as text; this tests the sync on its own).
- **Needs from Raashed:** the API client + the mock (hour 1), the deployed API URL (hour ~10).
- **Gives Ayush:** the GIF and screenshots for the website `/` and `/extension` pages (hour 17).
- **Gives Ayush:** the `.zip`, and an installed and tested build on the demo laptop (hour 19).

## Stretch

- [x] Keyboard shortcut Alt+S (`commands` in the manifest)
- [x] Learner mode: show the gloss text under the avatar (the "Show gloss" setting)
- [ ] Firefox build (the `webextension-polyfill`)
- [ ] Popup "Find signed videos" search box that calls `/api/discover` (**Exa**) and opens the result on YouTube with SignStream on
- [x] While a new video is processing, show "Translating with Cerebras…" with the time taken, so the speed is visible

## PR test cases

Every PR must pass these before review (tick them in the PR description). Also see the PR rules in PLAN §9.

- [ ] Load unpacked on a clean Chrome profile: no errors on the extensions page or the YouTube console (YouTube console clean and the worker starts; the `chrome://extensions` page itself not inspected yet)
- [x] Open 5 videos in a row **without reloading**: the panel remounts for each, and the right track loads each time
- [x] Pause, seek forward/back, 0.5× and 2× speed: the avatar follows within ~0.5s (gloss placeholder; re-check with the avatar)
- [x] Fullscreen and theater mode: the panel stays visible; the drag position is kept after reload
- [x] An ad plays: the panel hides or pauses and the avatar doesn't move
- [x] A video with no captions shows the error message; Shorts and live streams don't break the page
- [x] After 10 navigations, there is only one panel and no duplicate event listeners (check with DevTools)
- [x] The popup settings save and apply without reloading the page (settings live in the side panel)

## Definition of done

- [ ] Works on all 5 demo videos, and when you navigate between them without reloading
- [ ] The avatar stays within ~0.5s of the speech through pause, seek, 0.5×–2× speed and fullscreen
- [x] No console errors on YouTube; no leaked listeners after 10 navigations
- [ ] The `.zip` installs on a clean Chrome profile

## Demo role

You run the **live extension demo** (about 60s): open a YouTube video → turn on SignStream → the avatar signs → pause, seek, 1.5× speed → the avatar follows.

## Current integration work for your agent (P-I, 2026-11-01)

Read PLAN §§10–13. Reconcile your latest owner branch before building on the
published content-script placeholder. The shared mock/client and real API are
already merged; there is no need to wait for new endpoint shapes.

| Task     | Implement / verify                                                                                                               | Evidence required                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] P-I1 | Add MV3 manifest, compatible Vite/CRXJS setup, test/build scripts and reproducible unpacked/ZIP output                           | Clean Chrome load; bundle executable dependencies locally; minimal youtube/API host permissions and local asset resource declarations                       |
| [ ] P-I2 | Mount one Shadow DOM panel and a mock gloss display while Hasan finishes the renderer. Isolate YouTube DOM selectors/event hints | Current video ID/video replacement detected; no duplicate mount on repeated events; cancel observers and rAF on dispose                                     |
| [ ] P-I3 | Bind a media-clock adapter to the existing player API; pass `currentTime + offset` every frame and re-sample on paused seeks     | Pause, waiting/stalled/playing, forward/back seeks, 0.5×/2×, hidden-tab return; no timestamp double-scaling or independent sign timers                      |
| [x] P-I4 | Keep API work in short service-worker requests, with content-script polling or tested reconnecting messages and session cache    | Worker suspension/restart mid-processing; request identity and cancellation; old video's late response ignored; fixed API origin and validated message data |
| [ ] P-I5 | Load schema-validated partial/ready snapshots cumulatively, with progress/error/empty UI and a bounded polling lifetime          | Replace snapshots rather than append; partial→ready has no duplicate signs or reset to zero; seek beyond prepared data shows preparing/idle                 |
| [ ] P-I6 | Package Hasan's same model/dictionary/clips under extension assets and pass `chrome.runtime.getURL("assets/")`                   | Installed build resolves nested URLs; renderer works without CDN scripts or sponsor keys; no missing runtime model files                                    |
| [ ] P-I7 | Handle ads, fullscreen subtree, theater mode, Shorts/live exclusions, route changes and replacement videos                       | Ads never drive signs with ad time; fullscreen keeps panel visible; ten navigations leave one panel/clock and no old polling                                |
| [ ] P-I8 | Finish accessible toggle/popup/panel settings, keyboard controls and persisted offset/size/position                              | Settings apply without reload; minimize/off stops unnecessary rendering; focus/contrast and storage failure cases checked                                   |
| [ ] P-I9 | Release ZIP and a short capture from actual unpacked build; record code/asset/API revisions with Ayush                           | Fresh profile install, actual five-video matrix and working download path; no test env or secret bundled                                                    |

### Status on `poonam/extension` (2026-11-01)

Checked in a clean Chromium profile on real YouTube, with demo mode and with the API running locally (rule-only gloss, no keys). The avatar is still the gloss-text placeholder, so none of this is avatar evidence.

- **P-I1 (partial):** MV3 manifest in `manifest.config.ts`, Vite 8 + CRXJS 3, `dev` (`vite build --watch`), `build`, `zip` and `test` scripts; loads in a clean profile; all runtime JS bundled locally; the only host permission is the API origin, fixed at build time with `VITE_SIGNSTREAM_API_ORIGIN`. Left: the ZIP install itself is not tried yet.
- **P-I2 (partial):** one Shadow DOM panel with a gloss-text placeholder until `createAvatarPlayer` exists; selectors and event hints isolated in `content/youtube.ts`; one panel after 10 navigations; observers and rAF cancelled on dispose. The placeholder is labelled "Placeholder: gloss text until the avatar is ready". Left: URL-change fallback besides `yt-navigate-finish`, replacement `<video>` detection.
- **P-I3 (partial):** the rAF loop passes `currentTime + offset`, forwards play/pause/rate and re-samples on seeking/seeked, without scaling by rate. 0.5× and 2× matched the API track within 0.5s (24/24 samples each); paused seeks show the right sign. Left: freeze on waiting/stalled.
- **P-I4 (done):** the worker uses the shared `createApiClient().getSignTrack` per port request, with the ready-track cache in `chrome.storage.session` and no state that must survive suspension. Track requests carry a request id; the client ignores updates for other requests and reconnects when the worker drops the port. Stopping the worker with DevTools mid-request on real YouTube: the panel reconnected and finished loading. The API origin is fixed at build time, and every port message is validated with zod in the receiver.
- **P-I5 (not done):** only `ready` tracks load; partial snapshots are ignored (the shared client's `onPartial` is the next step).
- **P-I6 (not done):** sign assets ship at `sign-assets/` because Vite puts its chunks in `assets/`; move `build.assetsDir` so `chrome.runtime.getURL("assets/")` works, then package Hasan's model and clips.
- **P-I7 (partial):** ads show "Ad playing" and the avatar doesn't tick (seen with a real ad); the panel stays inside the fullscreen subtree above YouTube's controls; theater mode; Shorts skipped; live shows "not supported"; 10 navigations leave one panel and the same `<video>` listener count. Left: replacement video elements.
- **P-I8 (partial):** settings apply without reload; offset, size and position persist; Alt+S and the control-bar toggle. Left: stop rendering while minimized, focus/contrast check, storage-failure handling.
- **P-I9 (not started):** needs the real avatar and the five demo videos.
- **Plan deviation, settings and side panel:** settings live in a Chrome side panel (Phantom-style) instead of a popup. While it is open, the avatar renders there for the active tab, driven by video snapshots from the content script, and the floating panel hides; the floating panel is still the default and comes back in fullscreen, where Chrome hides the side panel. Ayush's `/extension` copy should mention it.

Do not serialize `onPartial` callbacks through `chrome.runtime.sendMessage`.
Messages carry data; the content script installs callbacks locally, or the
worker sends snapshot messages keyed by request/video. A worker-global promise
or interval is not guaranteed to survive suspension. Use the existing client
inside the worker only with a tested lifecycle strategy, or make one validated
HTTP request per polling tick. Do not turn the worker into an arbitrary-URL proxy.

Until H-I3 is ready, the mock panel can print current gloss/progress and exercise
pause/seek/navigation. Label it a placeholder, not a working signing avatar.
When integrating, preserve `assetsBaseUrl` behavior and leave clip parsing and
blending inside `@signstream/player`. Rendering belongs to the content script,
not a service worker. Backend sponsor/admin credentials stay on the backend.

### Additional PR test cases

- [x] Worker suspension and restart during polling recover or show a useful bounded error.
- [ ] Switching videos while an API/asset request is pending cannot load the old track into the new panel.
- [ ] Seeking while paused, buffering, ads and hidden-tab return maintain correct pose/time.
- [ ] Partial snapshots do not duplicate signs; seeking beyond available data never replays a stale sign.
- [ ] Built ZIP includes the renderer, model and clips; a clean Chrome profile resolves all asset URLs.
