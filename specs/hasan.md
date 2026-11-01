# Hasan: Avatar Engine + Website

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.4, §4.5

You have **two tracks**. The avatar comes first, because it is the hardest and most visible part of the project. Keep the website small: use a template and the pre-built components.

**Branches:** `hasan/player`, `hasan/web`

---

## Track A: Avatar and animation engine

### What you own
- `packages/player`: the `@signstream/player` package
- `packages/sign-assets`: animation clips + `dictionary.json`

### What you deliver
A player that takes a `SignTrack` and the current video time and makes a 3D avatar sign. Poonam (extension) and your own website both use it through the API in PLAN §4.4.

### Approach
1. **Avatar:** a free VRM model (VRoid Hub, or make one in VRoid Studio) loaded with `@pixiv/three-vrm`. VRM has a standard humanoid skeleton with finger bones, which signing needs.
2. **Clips:** each sign is a short JSON list of keyframes: per keyframe, the time plus rotations (quaternions) for the arm, hand and finger bones. Store them in `packages/sign-assets/clips/*.json`.
3. **Making clips (choose by hour 3):**
   - **Option 1, pose extraction (best quality):** run MediaPipe Holistic (`@mediapipe/tasks-vision`, in the browser, with a small TS script) on short sign videos (for example from the WLASL dataset or Lifeprint), then convert the landmarks into bone rotations with `kalidokit`. Save the result as clip JSON.
   - **Option 2, hand-made keyframes (fastest):** a small internal tool page with sliders for each bone, which exports clip JSON. Good for the fingerspelling alphabet, which needs only hand shapes.
4. **Playback:** `THREE.AnimationMixer`, with a ~0.15s crossfade between signs and an idle pose between segments.

### Tasks

| # | Task | Target hour |
|---|---|---|
| A1 | Scaffold `packages/player` (Vite library mode, TS), render a VRM avatar in a 300×400 canvas at 30 fps or more | 2 |
| A2 | Define the clip JSON format + a loader; make 1 sign (`HELLO`) play | 4 |
| A3 | Implement `createAvatarPlayer` with `load`, `tick`, `play`, `pause`, `setSpeed`, `destroy`, using the mock sign track | 6 ✅ checkpoint 1 |
| A4 | Fingerspelling: clips for all letters A–Z; `FS:BOB` plays B-O-B, about 0.12s per letter | 8 |
| A5 | Seeking: `tick(t)` jumps to the right sign when `t` jumps, not only when it moves forward | 9 |
| A6 | Build up the sign library: the **top 100 words** from Durgesh's list (more if time allows), and keep `dictionary.json` updated | 6–16 (ongoing) |
| A7 | **2D fallback** (`style: "2d"`): draw the pose as a skeleton on a 2D canvas from the same clip data. Build the basic version early, so the hour-12 decision is easy | 11 |
| A8 | `playSign(gloss)` for the `/signs` page; `showGloss` option (current gloss shown under the avatar) | 12 |
| A9 | Performance: lazy-load clips, keep the bundle under ~3 MB without the model, and dispose of WebGL resources in `destroy()` | 16 |

### Handoffs
- **Needs from Raashed:** the mock sign track (hour 1), and the `SignTrack` type from `packages/shared`.
- **Needs from Durgesh:** a ranked word list of the top 100–200 words to animate (hour 2).
- **Gives Poonam:** a working player package by **hour 6**, even if it only has a few signs. Tell Poonam about any API change right away.
- **Gives Durgesh:** an up-to-date `dictionary.json` (commit it whenever you add clips).

### Stretch
- Eyebrow raise for `nonManual: "question"`, head shake for `"negation"` (using VRM blend shapes)
- 2–3 avatar choices

---

## Track B: Website

### What you own
`apps/web`: Next.js (App Router) + Tailwind, deployed on Vercel.

**Keep it simple:** use shadcn/ui components. You own the app and build `/watch` and `/signs`. **Ayush builds `/` and `/extension`** inside your app, and you review those PRs. Spend about 30% of your time here and 70% on the avatar.

### Pages

| Route | Content | Priority |
|---|---|---|
| `/watch` | Paste a YouTube URL → YouTube IFrame Player on the left, avatar on the right. Poll `player.getCurrentTime()` in `requestAnimationFrame` → `avatar.tick(t)`. Forward play, pause and rate events. Show a loading state with `progress` while the track is processing. Support share links: `/watch?v=<id>` | **P0: this is the backup demo** |
| `/signs` | A grid of every gloss from `/api/signs` with a search box; click one → the avatar plays it with `playSign()`. Also useful for testing your own clips | P0 |
| `/` | Landing page. **Built by Ayush** | P1 |
| `/extension` | Install steps. **Built by Ayush** | P1 |

### Tasks

| # | Task | Target hour |
|---|---|---|
| B1 | Scaffold Next.js + Tailwind + shadcn, shared layout (header/footer, theme) and deploy an empty page to Vercel. Ayush starts on `/` after this | 2 |
| B2 | `/watch` working with the mock track and the player | 8 |
| B3 | `/watch` using the live API + loading and error states | 12 |
| B4 | `/signs` page | 13 |
| B5 | Review Ayush's `/` and `/extension` PRs; check the look matches across all pages | 17 |
| B6 | Accessibility check: keyboard navigation, focus rings, contrast, alt text, `prefers-reduced-motion`. Judges will look at this on an accessibility project | 18 |

### Handoffs
- **Needs from Raashed:** the API client from `packages/shared`, the deployed API URL (hour ~10).
- **Gives Ayush:** the scaffolded app with a shared layout (hour 2).
- If you fall behind, **give `/signs` to Ayush at checkpoint 1**. Don't let the website take time from the avatar.

---

## Definition of done
- [ ] The player package is used by both the extension and `/watch`, without changes between them
- [ ] The avatar plays at least 100 signs + A–Z fingerspelling, crossfades smoothly, and handles seeking
- [ ] The 2D fallback works
- [ ] `/watch` and `/signs` are live on Vercel

## Demo role
During the pitch, show the avatar quality on the `/signs` page: click 3–4 signs and fingerspell a name.
