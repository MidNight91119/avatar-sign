# @signstream/extension

Owner: **Poonam** · Spec: [specs/poonam.md](../../specs/poonam.md) · UI guide: [packages/ui/README.md](../../packages/ui/README.md)

Chrome MV3 extension, built with Vite + `@crxjs/vite-plugin`. The signside UI is a **Chrome side panel**
(from the design board), using the same `SignPanel` component as the website.

| File                 | Job                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `manifest.json`      | MV3 manifest: side panel, YouTube content script, `sidePanel` permission, `https://www.youtube.com/*` host  |
| `src/background.ts`  | Clicking the toolbar icon opens the side panel                                                               |
| `src/content.ts`     | On youtube.com: sends the main video's time/rate to the panel (skips ads and hover previews); applies speed |
| `src/sidepanel.tsx`  | The panel: reads the active tab's video ID, fetches the track after Start, shows the caption and the signing avatar |
| `src/media-clock.ts` | Turns the content script's ~4 reports/s into a smooth per-frame clock for the avatar (capped 1 s ahead) |

```bash
pnpm --filter @signstream/extension build    # → apps/extension/dist
pnpm --filter @signstream/extension dev      # rebuilds on change
```

Load it: `chrome://extensions` → Developer mode → **Load unpacked** → pick `apps/extension/dist`. Open a YouTube
video and click the signside icon. Set `VITE_API_URL` to the API origin when building; without it the panel uses
the shared mock track and labels it "demo track".

The avatar is the same `AvatarCanvas` as the website (procedural WebGL2 signer from `@signstream/player`; no model
or clip files to package). `pnpm --filter @signstream/extension test` runs the clock tests.

Not done yet (Poonam's spec): ads/fullscreen edge cases beyond skipping ad time, popup settings, a zip build.
The side panel is not visible in YouTube fullscreen; a floating in-page panel (P3) would cover that case.
