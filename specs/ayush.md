# Ayush: Demo and Pitch, Integration, Website Landing + Extension Pages

> Main plan: [../PLAN.md](../PLAN.md)

**Branch:** `ayush/web-pages`

You have three jobs:

1. **Product and demo owner:** choose the demo videos, write the story, run the pitch.
2. **Website pages:** build `/` (landing), `/extension` and `/discover` (**Exa**) inside Hasan's Next.js app, so Hasan can focus on the avatar.
3. **Integration owner:** from the halfway point, test everything end-to-end and track bugs.

---

> **2026-11-01 refresh:** Reconcile your latest branch with the [PLAN §10 baseline](../PLAN.md#10-implementation-baseline-and-next-gates), then follow the **Current integration work for your agent** section below. Original hour targets are historical; retain completed work and attach evidence for new acceptance tasks.

## 1. Hours 0–3: Demo videos and story

- [x] Establish the **five-video regression corpus**
  - The user requested official CS50 sources; Durgesh fetched five videos / 1,007 timed cues, listed in PLAN §10 and `apps/api/src/gloss/word-priorities.json`. These full videos are mostly longer than 1–3 minutes.
- [ ] Choose short presentation segments from that corpus and confirm their readability with Hasan/Durgesh. Separately agree a full >=180-second captioned video for the speed gate; an excerpt is not that benchmark.
  - A-I1 in progress: segments recorded in [`docs/pitch/demo-segments.md`](../docs/pitch/demo-segments.md) (Loops 6:42–8:01 live; Linear Search 0:15–1:32 and Binary Search 2:03–3:15 as backups) and agreed with Raashed in #21. Stage video and full-video API benchmark: `w1vhSSu8Nxw` (3:53, 9.9s cold total, kept uncached); full-video gloss benchmark: `96M4q0OnMfY` (3:33, 3.91s). Still open: the readability check once real clips exist.
- [ ] Write the pitch story and the deck outline (see §4)
- [ ] Write the copy (text) for the landing page

## 2. Hours 2–14: Website pages (in `apps/web`)

Hasan sets up the app, shared layout and theme by hour 2. You build these pages on top, using shadcn/ui components. Hasan reviews your PRs.

| Route        | Content                                                                                                                                                                                                                                                                                                                                                | Target hour |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `/`          | Hero ("Animated ASL support for captioned YouTube videos"), the problem, how it works (diagram from PLAN §2), a GIF of the extension, a demo video embed, buttons for "Try the demo" (→ `/watch`) and "Get the extension" (→ `/extension`), team section                                                                                               | 10          |
| `/discover`  | **Exa-powered search:** a search box ("photosynthesis", "how volcanoes work") → `/api/discover` → a grid of YouTube results with thumbnails → click one → `/watch?v=<id>` with the avatar. Add suggested topic chips and a small "Search powered by Exa" label                                                                                         | 12          |
| `/extension` | Download button for the `.zip` (GitHub release), "load unpacked" steps with screenshots, a short FAQ (which videos work, accurate privacy explanation: extension sends video ID/settings needed for the request; backend fetches captions and sends caption text to Cerebras and video metadata/search queries to Exa; admin secrets stay server-side) | 12          |

- [ ] Use placeholder images until Poonam sends the GIF and screenshots (hour 17)
- [ ] Accessibility on your pages: semantic headings, alt text, keyboard navigation, contrast, `prefers-reduced-motion` for the GIF
- [ ] "Powered by Cerebras and Exa" section on the landing page (with sponsor logos from their brand kits) explaining what each one does in SignStream
- [ ] Open Graph image + meta tags so shared links look good
- [ ] If Hasan needs to transfer `/signs`, first record the handoff and obtain explicit source-scope/ownership authorization; do not edit it solely because the schedule is late

## 3. Hours 12–18: Integration owner

- [ ] Run the full flow (extension + `/watch`) on all 5 videos after each merge to `main`
- [ ] Keep a bug list as GitHub Issues: owner, steps to reproduce, severity (P0 = breaks the demo)
- [ ] Check the sync by eye: mark any sign that is more than 0.5s off, and send it to Durgesh (timing) or Poonam (sync)
- [ ] Reuse Durgesh's measured word-priorities/missing-sign reports, and add visual-readability findings from the demo segments for Hasan and Durgesh

## 4. Hours 18–24: Demo and pitch

### Pitch deck (6–8 slides)

1. The problem: about 70 million Deaf people worldwide use more than 300 sign languages (World Federation of the Deaf; **check this before presenting**), and almost no online video has sign interpretation
2. Our solution: one-line description + a screenshot
3. Live demo (switch to the browser)
4. How it works: the pipeline diagram (Raashed)
5. Why it's hard: gloss ≠ English (Durgesh)
6. **Built with Cerebras and Exa:** Cerebras speed numbers that **we measured** (whole video glossed in N seconds, from Durgesh); Cerebras advertises ~3,000 tokens/s on `gpt-oss-120b`, so say where that number comes from if you use it. Also show the three ways we use Exa (context, Discover, sign references)
7. What's next: ISL, a bigger sign library, facial expressions, translations reviewed by the Deaf community
8. Team

### Demo script (about 3 minutes)

| Time | Who     | What                                                                                                                  |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Ayush   | Hook + the problem                                                                                                    |
| 0:30 | Poonam  | Live extension: turn it on → avatar signs → pause / seek / 1.5×                                                       |
| 1:10 | Ayush   | `/discover` (**Exa**): search a topic → open a **new, uncached** video → it's ready in seconds thanks to **Cerebras** |
| 1:30 | Hasan   | `/signs` page: avatar quality + fingerspelling a judge's name                                                         |
| 2:00 | Durgesh | Gloss slide: before/after example                                                                                     |
| 2:20 | Raashed | Architecture (20s)                                                                                                    |
| 2:40 | Ayush   | What's next + close                                                                                                   |

### Backup plan

- [ ] Record a screen capture of the whole demo (hour 20) and keep it offline on the demo laptop
- [ ] Demo laptop: extension installed (from Poonam), local API + cache running (from Raashed), demo videos open in tabs, ads turned off (YouTube Premium or an ad-free account), notifications muted
- [ ] If the extension fails → use the website `/watch` page. If the network fails → play the recording
- [ ] Lead **2 full rehearsals** with a timer
- [ ] Prepare answers for likely judge questions: accuracy, how big the dictionary is, ASL vs ISL, involving the Deaf community, cost per video (PLAN §2.2 contains kickoff estimates; quote measured or currently verified billing and name the cache/provider scope), why Cerebras and Exa (speed; grounding in real web data)

## Handoffs

- **Gives Raashed:** confirmed CS50 presentation ranges and full-video speed benchmark; the five regression video IDs are already in PLAN §10.
- **Needs from Hasan:** the scaffolded app + layout (hour 2); PR reviews.
- **Needs from Poonam:** the GIF and screenshots (hour 17); the `.zip` + an install on the demo laptop (hour 19).
- **Needs from Raashed:** the local API with the cache on the demo laptop (hour 20).
- **Needs from Raashed:** `/api/discover` (hour 11).
- **Needs from Durgesh:** Cerebras speed numbers (hour 16).
- **Needs from everyone:** their slide content by hour 19.

## PR test cases

Every PR must pass these before review (tick them in the PR description). Also see the PR rules in PLAN §9.

- [ ] `/`, `/extension` and `/discover` pass a Lighthouse accessibility check with ≥ 90, and work with the keyboard only
- [ ] All pages look right at phone width (375px) and desktop, in light and dark mode
- [ ] `/discover`: a search shows results; clicking one opens `/watch?v=<id>`; an empty result and an API error show friendly messages
- [ ] The `.zip` download link and every link on the landing page work (no 404s)
- [ ] Open Graph preview looks right (test with a link preview tool)
- [ ] For integration PRs: the full demo flow on all 5 demo videos, with results in the PR description

## Definition of done

- [ ] `/`, `/extension` and `/discover` are live and match the rest of the site
- [ ] The demo shows both sponsors live: Exa search on `/discover` and Cerebras speed on a new video
- [ ] Every demo video was tested end-to-end in the extension and on `/watch`
- [ ] Deck finished, backup recording made, 2 rehearsals done

## Current integration work for your agent (A-I, 2026-11-01)

Read PLAN §§10–13. Inspect your current branch before changing the published
starter landing route. Keep your scope to the paths in `.github/owners.json`;
coordinate shared layout/style changes with Hasan rather than rebuilding them.

| Task     | Implement / verify                                                                                                                              | Evidence required                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] A-I1 | Confirm the selected CS50 corpus and mark exact presentation start/end offsets; agree the independent full >=180s speed benchmark               | One shared list linked to PLAN §10, no competing five-video list; full-video vs excerpt labels and caption availability recorded                   |
| [ ] A-I2 | Build landing and extension pages on Hasan's agreed styles, with caption/ASL/length limitations and accurate data-flow copy                     | Keyboard/mobile/light/dark checks; meaningful loading/error copy; no promise that every video is supported or every output is accurate             |
| [ ] A-I3 | Build `/discover` with the existing shared client, cancel stale searches, and link validated results to `/watch?v=`                             | Success, empty, 429/unavailable, stale-result and keyboard cases; sponsor attribution; no backend keys in browser env                              |
| [ ] A-I4 | Create the integration evidence matrix below and run it after relevant merges, routing issues to the responsible owner                          | Actual extension and website results, commit/build/asset/API revisions, device, steps, pass/fail/not-run and issue link                            |
| [ ] A-I5 | Replace placeholders with real screenshots/GIF/download links when P-I9 arrives; make motion optional and preserve readable alternative content | Fresh ZIP install and working links, responsive screenshots, paused/accessible media, actual product screenshots rather than mock claims           |
| [ ] A-I6 | Prepare pitch/deck and two timed rehearsals using measured cold/warm/provider timings and observed signing quality                              | Sponsor live/cached actions labelled; stats/pricing verified before presenting; unresolved acceptance gates disclosed rather than inferred from CI |
| [ ] A-I7 | Record backup demo and test the local cached API handoff with Raashed                                                                           | Cache import works without sponsor calls; full offline fallback is a recording, because an uncached YouTube video still requires internet          |

### Shared integration evidence matrix

For every selected CS50 video in **each** host, record:

- Caption/source, ready/partial/error behavior, actual dictionary coverage and
  missing clips; separately label fixture, cached, fallback and live-provider runs.
- Playback at 0.5×/1×/2×, pause/buffer/resume, forward/backward seek while paused
  and playing, and observed sync offset (target ~0.5s or better).
- Extension ads/fullscreen/navigation, website video changes, asset failures and
  absent captions. Ten navigations must not leak panel/player instances.
- Readable finger shape/strokes/face and pacing assessed with signing expertise;
  a renderer reaching 30fps or matching gloss labels is not a language-quality test.
- Cold API total, gloss-only time and warm cache separately. Use the complete
  agreed benchmark for speed claims; a selected stage segment proves only itself.

Create follow-up issues with owner, exact reproduction, severity and artifact
revision; do not fix another owner's source as an integration shortcut. The next
PR should be a small owned page or evidence artifact that advances G1/G2, not a
second implementation of the player, API client or extension.

### Additional PR test cases

- [ ] Privacy/support copy matches actual caption/provider processing and supported ASL/captioned-video scope.
- [ ] Stale Discover requests cannot replace newer results; 429/empty/unavailable states are useful.
- [ ] Corpus-wide matrix distinguishes unrun, mocked, cached, fallback and genuine provider/visual evidence.
- [ ] Every presented latency number names its scope and full-video/excerpt status; backup playback is rehearsed.
