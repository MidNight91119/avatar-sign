# @repo/ui: signside UI and frontend guide

Owner: **Hasan** · Spec: [specs/hasan.md](../../specs/hasan.md) · Design: the "Sign Language Extension" design board (panel states, browser mock, wordmark, website)

The product is called **signside** in the UI. Package names stay `@signstream/*`; renaming them is a team decision (PLAN §4).
Keep this file up to date when you change the look, a component, or a page.

## Brand

| Thing    | Value                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Logo     | Hand mark from the logo sheet: `apps/web/public/brand/hand.png` (small, transparent), `hand-primary.png` (with orange circle) |
| Wordmark | `<Wordmark />`: "sign" in Inter Tight 600 + "side" in Instrument Serif italic                                              |
| Fonts    | Inter (body), Inter Tight (display), Instrument Serif italic (accents). Hosts set `--font-inter`, `--font-inter-tight`, `--font-instrument-serif` |
| Colors   | Page `#F3F2F0`, cards `#E9E8E5`, ink `#111`, muted `#57524E`, accent `#C9553C` (large text only, 3.9:1), orange `#F2581F`, live dot `#FF5A1F`, connected dot `#22B455` |
| Shapes   | Pills (`999px`) for buttons and inputs, 28px cards, 32px panel, frosted glass (`backdrop-filter: blur`) over warm gradients |

## What's in this package

| Export                     | What it is                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@repo/ui/sign-panel`      | `SignPanel` (the designed panel) and `Wordmark`                                                              |
| `@repo/ui/avatar-canvas`   | `AvatarCanvas`: the signing avatar from `@signstream/player` as a React component (client only)             |
| `@repo/ui/styles.css`      | All panel/wordmark styles, `ss-` prefixed. Import once per host                                             |
| `@repo/ui/caption`         | `captionAt(track, t)`, `splitAtGloss(text, gloss)`, `trackErrorMessage(code)`, `SPEEDS`/`nextSpeed`           |
| `@repo/ui/youtube`         | `parseVideoId(link)` (watch / youtu.be / embed links or a bare ID), `formatClock(seconds)`                    |
| `@repo/ui/use-sign-track`  | `useSignTrack(api, videoId, lang)`: track + progress + error, partial snapshots, cancels stale requests       |

`SignPanel` is presentational: the host passes `mode` (`none` / `idle` / `signing`), texts, the caption at the
current media time and callbacks. Leaving a callback out hides or disables its control. The signer goes in the
`avatar` slot and is drawn behind the glass cards:

```tsx
<SignPanel
  mode="signing"
  avatar={<AvatarCanvas track={track} getTime={() => player.getCurrentTime()} paused={paused} />}
  caption={captionAt(track, time)}
  /* … */
/>
```

`AvatarCanvas` reads `getTime()` every animation frame itself, so the host only keeps a slow clock (5×/s) for the
caption text. Pass `sign={{ gloss, key }}` instead of `getTime` for one-off previews. How the avatar works:
[packages/player/README.md](../player/README.md).

## Website (`apps/web`)

Next.js App Router, plain CSS (no Tailwind/shadcn: the design is custom gradients and glass, and plain CSS kept it
to a few files). Design tokens and shared layout live in `app/globals.css`; the landing page has its own CSS module.

| Route    | What it does                                                                                                                                        | Owner |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `/`      | Landing page from the design board. The hero is a live demo: the avatar signs the sample track on a loop, with the subtitle in sync | Ayush |
| `/watch` | `?v=` takes a link or an ID. YouTube IFrame API on the left, signing panel on the right, both on the video's clock; speed chip sets the video rate | Hasan |
| `/signs` | Every sign the avatar knows (from the player) with search; unknown words are fingerspelled and fetch Exa "how to sign it" links on submit only | Hasan |

### Where things live

```text
apps/web/
├── app/                     routes only: layout, page.tsx files, globals.css (tokens, layout, /watch and /signs styles)
├── components/
│   ├── site/                SiteNav, SiteFooter (used by app/layout.tsx)
│   ├── landing/             one file per landing section + content.ts (all the copy) + icons + landing.module.css
│   ├── watch/watch-view.tsx /watch: YouTube player + SignPanel + AvatarCanvas
│   ├── signs/signs-view.tsx /signs: sign grid, search, Exa references, preview avatar
│   └── link-form.tsx        "Paste a YouTube link" GET form → /watch?v=
├── hooks/
│   ├── use-youtube-player.ts  mounts the IFrame player; exposes getTime, paused, rate, setRate
│   └── use-polled-time.ts     media time as React state, a few times a second (captions, live clock)
└── lib/
    ├── api.ts               shared API client (mock when NEXT_PUBLIC_API_URL is unset) + demoApi for the hero
    └── youtube-iframe.ts    loads the IFrame API once; its types
```

To add a page: a route in `app/<name>/page.tsx` (server, metadata) that renders a view from `components/<name>/`.
Put copy in data, hooks in `hooks/`, and anything the extension could reuse in `packages/ui`.

Run: `pnpm --filter @signstream/web dev`. Set `NEXT_PUBLIC_API_URL` to the API origin; without it the site uses the
shared mock data and says "demo" on screen.

## Rules

- Plain CSS, `ss-` prefix for anything in this package; no new UI library without a reason.
- Every interactive thing is a real `<button>`, `<a>` or `<form>`; focus rings stay visible; text on the orange card is dark (white fails contrast).
- Motion: scroll reveals are off under `prefers-reduced-motion`, and the landing demo holds one still sign. A paused video means still hands: `AvatarCanvas paused` fades out the idle sway (PLAN §11.4).
- Never show the previous video's signs: `useSignTrack` ignores results for an old video or language.
- Label mock data as demo data on screen (PLAN G2: mocked runs labelled separately).

## Next

- Mount `AvatarCanvas` in the extension side panel too (same component; it needs a per-frame clock from the content script).
- Fill `packages/sign-assets/dictionary.json` from `knownSigns()` so the gloss module uses these signs (needs Durgesh: multi-word keys).
