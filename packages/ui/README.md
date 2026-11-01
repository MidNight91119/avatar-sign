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
| `@repo/ui/sign-panel`      | `SignPanel` (the designed panel), `Wordmark`, `AvatarFigure` (flat SVG placeholder until the 3D player lands) |
| `@repo/ui/styles.css`      | All panel/wordmark styles, `ss-` prefixed. Import once per host                                             |
| `@repo/ui/caption`         | `captionAt(track, t)`, `splitAtGloss(text, gloss)`, `trackErrorMessage(code)`, `SPEEDS`/`nextSpeed`           |
| `@repo/ui/youtube`         | `parseVideoId(link)` (watch / youtu.be / embed links or a bare ID), `formatClock(seconds)`                    |
| `@repo/ui/use-sign-track`  | `useSignTrack(api, videoId, lang)`: track + progress + error, partial snapshots, cancels stale requests       |

`SignPanel` is presentational: the host passes `mode` (`none` / `idle` / `signing`), texts, the caption at the
current media time and callbacks. Leaving a callback out hides or disables its control, so the same component
works as a static picture (landing hero, server-rendered) and as a live panel.

## Website (`apps/web`)

Next.js App Router, plain CSS (no Tailwind/shadcn: the design is custom gradients and glass, and plain CSS kept it
to a few files). Design tokens and shared layout live in `app/globals.css`; the landing page has its own CSS module.

| Route    | What it does                                                                                                                                        | Owner |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `/`      | Landing page from the design board. Hero form and bottom form send a pasted link to `/watch`                                                       | Ayush |
| `/watch` | `?v=` takes a link or an ID. YouTube IFrame API on the left, panel on the right; caption follows `getCurrentTime()` (polled 5×/s); speed chip sets the video rate | Hasan |
| `/signs` | Sign list from `/api/signs` with search; unknown words fingerspell and fetch Exa "how to sign it" links on submit only (each lookup costs credit)  | Hasan |

Shared layout (`app/layout.tsx`): dark pill nav (hand mark + wordmark, Why signing, Signs, Try it), skip link, footer.

Run: `pnpm --filter @signstream/web dev`. Set `NEXT_PUBLIC_API_URL` to the API origin; without it the site uses the
shared mock data and says "demo" on screen.

## Rules

- Plain CSS, `ss-` prefix for anything in this package; no new UI library without a reason.
- Every interactive thing is a real `<button>`, `<a>` or `<form>`; focus rings stay visible; text on the orange card is dark (white fails contrast).
- Motion: scroll reveals and hand movement are off under `prefers-reduced-motion`. Signing hands move only when a new sign starts, so a paused video means still hands (PLAN §11.4).
- Never show the previous video's signs: `useSignTrack` ignores results for an old video or language.
- Label mock data as demo data on screen (PLAN G2: mocked runs labelled separately).

## Next

- Replace `AvatarFigure` with the real player (`createAvatarPlayer`, H-I3/H-I4) inside the panel; keep `SignPanel`'s props.
- Move `/watch` from 5 Hz polling to the player's own rAF `tick(t)`, without React state per frame (H-I8).
