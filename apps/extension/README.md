# @signstream/extension

Owner: **Poonam** · Spec: [specs/poonam.md](../../specs/poonam.md)

Chrome MV3 extension that adds the signing avatar to YouTube watch pages, in sync with the video.

- **Side panel (main view):** click the SignStream icon and the avatar docks on the right, like Phantom's side panel. YouTube shrinks to make room, so nothing covers the video. Settings live here too (the sliders icon).
- **Floating panel on the video:** shown while the side panel is closed, and in fullscreen (where Chrome hides the side panel).

| Side panel | Settings | Floating panel |
|---|---|---|
| ![Side panel](docs/screenshots/side-panel.png) | ![Settings](docs/screenshots/side-panel-settings.png) | ![Floating panel on YouTube](docs/screenshots/floating-panel.jpg) |

## Run it

```sh
pnpm install                                   # from the repo root
pnpm --filter @signstream/extension dev        # rebuilds apps/extension/dist on every save
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `apps/extension/dist`. Open any YouTube video.

- **No API running?** Open the side panel → settings → **Developer settings** → **Demo mode**. Every video then gets a built-in mock track, so you can check the avatar and the sync.
- **API URL:** defaults to `http://localhost:8787` (`apps/api` on `pnpm dev`). Change it under **Developer settings**, or change `DEFAULT_API_BASE_URL` in `src/config.ts` for the release build. If the deployed API isn't on Railway, Render or Fly, add its origin to `API_HOST_PERMISSIONS` in the same file.
- After a change, click ↻ on the extension in `chrome://extensions` and refresh the YouTube tab. (`dev` is `vite build --watch`, not the CRXJS dev server: that one serves the side panel and worker from localhost and reloads the whole extension, which breaks the YouTube tab's connection.)

| Command | What it does |
|---|---|
| `pnpm --filter @signstream/extension build` | Production build in `dist/` |
| `pnpm --filter @signstream/extension zip` | Build + `signstream-extension.zip` for the GitHub release |
| `pnpm --filter @signstream/extension test` | `bun test` (unit tests + DOM tests with happy-dom) |

## How it works

```
side panel (React)                         content script (youtube.com)               background worker
  App / WatchView / SettingsView             app.ts      SPA navigation, one session      index.ts   "sign-track" port:
  active-tab.ts  connects to the active ───▶ sidebar-link.ts  page info + <video>         fetch, poll, cache,
                 tab ("sidepanel" port)                     state (events + timeupdate)   side panel on icon
  remote-video.ts  the video's clock,        session.ts  floating panel + player          click, Alt+S
                   interpolated between      panel.ts    Shadow DOM: drag, resize,
                   updates                               minimize, snap, saved layout
  avatar/  player, placeholder, sync loop ── shared with the floating panel ──
```

- **Sync:** `avatar/sync.ts` runs a rAF loop that calls `player.tick(time + offset)` and maps play/pause/seek/rate events. On the page it reads the `<video>` directly; in the side panel it reads `RemoteVideo`, which follows the snapshots the page sends (~4×/s plus every media event) and runs on the local clock in between.
- **Ads:** while `#movie_player` has `ad-showing`, the avatar doesn't tick (the `<video>` shows ad time) and both views say "Ad playing".
- **Fullscreen:** the floating panel moves inside `document.fullscreenElement` and stays above YouTube's controls (also when the side panel is open, since Chrome hides it in fullscreen).
- **Shorts** are skipped. **Live streams** show "not supported" without calling the API.

## Waiting on teammates

- **`src/contracts.ts`** mirrors PLAN §4.1 and §4.4 because `packages/shared` doesn't export the schemas yet. Switch the imports to `@signstream/shared` and delete the file when Raashed's schemas land.
- **`src/avatar/player.ts`** uses Hasan's `createAvatarPlayer` as soon as `@signstream/player` exports it. Until then, a placeholder prints the current gloss as text.
- **Sign assets:** the build copies `packages/sign-assets` to `sign-assets/` (not `assets/`, which Vite uses for its chunks), and the player gets `assetsBaseUrl: chrome.runtime.getURL("sign-assets/")`.
