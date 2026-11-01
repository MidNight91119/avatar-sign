# Hasan: Avatar Engine + Website

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.4, §4.5

You have **two tracks**. The avatar comes first, because it is the hardest and most visible part of the project. Keep the website small: use a template and the pre-built components.

**Branches:** `hasan/player`, `hasan/web`

> **2026-11-01 refresh:** Reconcile your latest branch with the [PLAN §10 baseline](../PLAN.md#10-implementation-baseline-and-next-gates), then follow the **Current integration work for your agent** section below. Original hour targets are historical; retain completed work and attach evidence for new acceptance tasks.

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
   - **Option 1, optional pose extraction (quality must be verified):** experiment with MediaPipe landmarks on appropriately licensed reference signing videos, then retarget/calibrate the landmarks onto the chosen rig and clean up the motion before saving clip JSON. Kalidokit is deprecated upstream and is not the default converter. Prototype one compatible extraction path before adopting a browser package/API; tracking alone does not establish valid signs.
   - **Option 2, hand-made keyframes (fastest):** a small internal tool page with sliders for each bone, which exports clip JSON. Useful for static alphabet poses; J and Z also require motion, and hand orientation/placement still need review.
4. **Playback:** `THREE.AnimationMixer`, sampled from absolute media time, with brief bounded transitions where linguistically appropriate and an idle pose in gaps (PLAN §11).

### Tasks

| #   | Task                                                                                                                                                                                                                               | Target hour       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1  | Scaffold `packages/player` (Vite library mode, TS), render a VRM avatar in a 300×400 canvas at 30 fps or more                                                                                                                      | 2                 |
| A2  | Define the clip JSON format + a loader; make 1 sign (`HELLO`) play                                                                                                                                                                 | 4                 |
| A3  | Implement `createAvatarPlayer` with `load`, `tick`, `play`, `pause`, `setSpeed`, `destroy`, using the mock sign track                                                                                                              | 6 ✅ checkpoint 1 |
| A4  | Fingerspelling: clips for all letters A–Z; `FS:BOB` plays B-O-B within its allocated sign slot; letter timing is a reviewed pacing target, not an independent timer that overruns the slot                                         | 8                 |
| A5  | Seeking: `tick(t)` jumps to the right sign when `t` jumps, not only when it moves forward                                                                                                                                          | 9                 |
| A6  | Build up the sign library: the **top 100 words** from Durgesh's list (more if time allows), and keep `dictionary.json` updated                                                                                                     | 6–16 (ongoing)    |
| A7  | **2D fallback** (internal renderer selection; no new public option without contract agreement): draw the pose as a skeleton on a 2D canvas from the same clip data. Build the basic version early, so the hour-12 decision is easy | 11                |
| A8  | `playSign(gloss)` for the `/signs` page; `showGloss` option (current gloss shown under the avatar)                                                                                                                                 | 12                |
| A9  | Performance: lazy-load clips, keep the bundle under ~3 MB without the model, and dispose of WebGL resources in `destroy()`                                                                                                         | 16                |

### Handoffs

- **Available from Raashed:** merged mock track, shared schemas/types and typed API client; use these now. Deployment configuration is still a separate handoff.
- **Available from Durgesh:** measured top-200 CS50 priorities and missing-sign frequencies. Live **Exa** reference links remain pending; do not block the first three manually reviewed clips on those links.
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

| Route        | Content                                                                                                                                                                                                                                                                                                       | Priority                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `/watch`     | Paste a YouTube URL → YouTube IFrame Player on the left, avatar on the right. Poll `player.getCurrentTime()` in `requestAnimationFrame` → `avatar.tick(t)`. Forward play, pause and rate events. Show a loading state with `progress` while the track is processing. Support share links: `/watch?v=<id>`     | **P0: this is the backup demo** |
| `/signs`     | A grid of every gloss from `/api/signs` with a search box; click one → the avatar plays it with `playSign()`. If someone searches for a word we don't have, the avatar fingerspells it and the page shows "How to sign it" links from `/api/sign-reference` (**Exa**). Also useful for testing your own clips | P0                              |
| `/`          | Landing page. **Built by Ayush**                                                                                                                                                                                                                                                                              | P1                              |
| `/discover`  | Find videos by topic (**Exa**). **Built by Ayush**                                                                                                                                                                                                                                                            | P1                              |
| `/extension` | Install steps. **Built by Ayush**                                                                                                                                                                                                                                                                             | P1                              |

### Tasks

| #   | Task                                                                                                                                                      | Target hour |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| B1  | Scaffold Next.js + Tailwind + shadcn, shared layout (header/footer, theme) and deploy an empty page to Vercel. Ayush starts on `/` after this             | 2           |
| B2  | `/watch` working with the mock track and the player                                                                                                       | 8           |
| B3  | `/watch` using the live API + loading and error states                                                                                                    | 12          |
| B4  | `/signs` page, including the Exa "How to sign it" links                                                                                                   | 13          |
| B5  | Review Ayush's `/` and `/extension` PRs; check the look matches across all pages                                                                          | 17          |
| B6  | Accessibility check: keyboard navigation, focus rings, contrast, alt text, `prefers-reduced-motion`. Judges will look at this on an accessibility project | 18          |

### Handoffs

- **Needs from Raashed:** the API client from `packages/shared`, the deployed API URL (hour ~10).
- **Gives Ayush:** the scaffolded app with a shared layout (hour 2).
- If you fall behind, **give `/signs` to Ayush at checkpoint 1**. Don't let the website take time from the avatar.

---

## PR test cases

Every PR must pass these before review (tick them in the PR description). Also see the PR rules in PLAN §9.

- [ ] Player: `load` + `tick` with the mock track plays the right sign at 3 different times (unit test on the scheduling logic)
- [ ] Seeking forward and backward jumps to the right sign; no stuck pose
- [ ] `FS:BOB` fingerspells B-O-B; an unknown gloss falls back to fingerspelling, not an error
- [ ] `destroy()` frees WebGL resources: mount/destroy 10 times with no growing memory in DevTools
- [ ] Runs at ≥ 30 fps in a 300×400 panel on a normal laptop; the 2D fallback renders the same track
- [ ] Every clip listed in `dictionary.json` exists and loads (test that checks the files)
- [ ] Website `/watch`: plays, pauses, seeks and changes speed in sync; shows loading and error states; works at phone width
- [ ] `/signs`: search works; a missing word shows Exa "How to sign it" links; keyboard navigation works

## Definition of done

- [ ] The player package is used by both the extension and `/watch`, without changes between them
- [ ] The avatar plays at least 100 signs + A–Z fingerspelling, crossfades smoothly, and handles seeking
- [ ] The 2D fallback works
- [ ] `/watch` and `/signs` are live on Vercel

## Demo role

During the pitch, show the avatar quality on the `/signs` page: click 3–4 signs and fingerspell a name.

## Current integration work for your agent (H-I, 2026-11-01)

Read PLAN §§10–13 and reconcile any local player/web branch first. Published main
has a player placeholder, empty signs/letters and a web starter. These facts do
not mean local work must be discarded. Do not duplicate already implemented clips.

| Task      | Implement / verify                                                                                                                                                   | Evidence required                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] H-I1  | Add compatible Three.js/three-vrm dependencies and owned test/build scripts; choose one redistributable VRM with usable finger bones                                 | Avatar renders in extension-sized canvas; record library/rig versions and asset license/source; pnpm lockfile only                                   |
| [ ] H-I2  | Define the local versioned JSON clip schema/loader from PLAN §11, and author three reviewed signs plus idle on the same rig                                          | Finite/increasing keyframes, normalized rotations, valid bones/duration; reject corrupt/incompatible clips; sample start/mid/end                     |
| [ ] H-I3  | Implement existing `createAvatarPlayer` API with a deterministic scheduler independent of rendering. Index instances by time, including repeated glosses             | Tests at boundaries, gaps, backward/forward seeks, repeated words and fractional timestamps; no wall-clock queue                                     |
| [ ] H-I4  | Evaluate absolute clip progress and media-time blend weights; clear blends on seek, hold hands on pause/buffer, handle load-before-assets and seek-before-clip-ready | Same timestamp produces same pose; no 2× double-scaling; no stale pose when clip fails; readable transitions at 0.5×/1×/2×                           |
| [ ] H-I5  | Add A–Z (J/Z motion included) and digit handling for numeric FS; map each character into the supplied sign slot                                                      | BOB, repeated letters and 23 tested; missing glyph shown explicitly; dense/long FS surfaced to Durgesh rather than silently overrunning              |
| [ ] H-I6  | Support repeated cumulative `load` snapshots without restarting media time; lazy preload nearby assets and release all resources on destroy                          | Mock partial→larger partial→ready, missing asset, ten mount/destroy cycles; no orphaned rAF or accumulated GPU resources                             |
| [ ] H-I7  | Deliver the first player/clip bundle to Poonam before bulk vocabulary. Then expand using Durgesh's measured top-200 and missing-sign report                          | Existing dictionary shape retained; every advertised path loads from website and extension base URLs; only validated playable clips become sign keys |
| [ ] H-I8  | Build `/watch` as a client boundary using the YouTube IFrame API + shared API client, cancellation and the same player                                               | URL/video changes, progress/partial/error, playback/rate/seek, phone width; iframe DOM never read; no per-frame React state updates                  |
| [ ] H-I9  | Build `/signs` using `/api/signs` and existing reference API; standalone preview returns to host timeline on next tick                                               | Known sign and FS preview, references/empty/error states, keyboard navigation, no duplicate renderer                                                 |
| [ ] H-I10 | Implement and test the 2D renderer/fallback with the same schedule/clip data if VRM performance or availability blocks G1                                            | Compare schedule decisions across renderers; no public `style` parameter added unilaterally; measure >=30fps on demo laptop                          |

### Concrete player semantics

- `tick(t)` samples media seconds; neither `setSpeed` nor mixer timeScale may
  multiply that timestamp again. Preview time is separate from video time.
- Resolve initialization/preloading internally while preserving the synchronous
  public API. Reapply the latest track/time when assets finish. `destroy()` makes
  late async results harmless. Keep initial loading/asset failures visible in
  the player container without inventing another required callback contract.
- `FS:` letters consume the allocated duration as a group. Do not claim a
  0.25-second slot makes a long name readable; report those cases for review.
- Smooth transition windows must preserve meaningful handshapes/strokes. Model
  secondary motion must not keep signing hands moving while the video is paused.
- Use the same bone conventions in authoring, VRM playback and 2D fallback;
  do not mirror left/right hands accidentally when retargeting reference video.

First handoff: working factory export, example `load`/`tick` integration, one
asset folder with dictionary/model/clips, packaging instructions for
`assetsBaseUrl`, and scheduler tests. Poonam must not need MediaPipe or motion
retargeting at runtime. Lottie is optional UI work and is not this player's engine.
Coordinate styling/shared layout with Ayush; Tailwind/shadcn are not installed in
the inspected baseline, so either add the agreed setup or use existing CSS.

### Additional PR test cases

- [ ] Deterministic poses at 0%, 50%, endpoint; arbitrary seeks, pauses and speed changes do not drift.
- [ ] An early partial snapshot, late asset, failed asset and superseded load never show the previous video's sign.
- [ ] Same built model/clip paths load inside the installed extension and `/watch`.
- [ ] All advertised signs and A–Z/digit behavior are visually reviewed; performance/resource evidence includes device and renderer.
