# Raashed: Backend (Monorepo, Contracts, Transcript, API)

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4 (you own §4.1, §4.3 and `packages/shared`)

**Branch:** `raashed/api`

## What you own

- The monorepo setup and tooling
- `packages/shared`: zod schemas, TS types, the typed API client
- `mocks/sign-track.sample.json`
- `apps/api`: Hono server, transcript fetching, the job pipeline, cache, deploy

Everyone depends on your **hour-1** work, so that comes first.

## Stack

Bun runtime, Hono, `youtubei.js`, **`exa-js`** (sponsor), `zod`, `bun:sqlite` (or Upstash Redis on serverless), `p-limit`, `bun test`. The workspace is Turborepo + pnpm.

> **2026-11-01 refresh:** Reconcile your latest branch with the [PLAN §10 baseline](../PLAN.md#10-implementation-baseline-and-next-gates), then follow the **Current integration work for your agent** section below. Original hour targets are historical; retain completed work and attach evidence for new acceptance tasks.

---

## 1. Hour 0–1: Unblock everyone (top priority)

- [x] Turborepo + pnpm monorepo: `apps/{api,extension,web}`, `packages/{player,sign-assets,shared,ui,typescript-config,eslint-config}`, strict TS, ESLint + Prettier, Bun for the API and tests, root scripts (`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm pr-check`)
- [x] `packages/shared`: zod schemas + TS types from PLAN §4.1 (`SignTrack`, `Segment`, `Sign`, `SignLang`). Export the types with `z.infer` so they can't drift from the schemas
- [x] `packages/shared`: a typed API client (also `discover`, `signReference`, `health`, `ApiClientError`, and `mock: true` / `MOCK=1` mode):
  ```ts
  createApiClient({ baseUrl })
    .getSignTrack(videoId, lang, { onProgress }) // polls every 2s until "ready" or "error"
    .getSigns(lang); // string[]
  ```
- [x] `mocks/sign-track.sample.json`: about 60s of a real video, written by hand, with real glosses (`HELLO`, `MY`, `NAME`, `FS:...`). Add a `MOCK=1` mode to the client that returns the mock, so Hasan and Poonam can build before the API exists
  - Done: zod schemas also cover `Caption`, `VideoContext` (+ JSON schema for Exa/Cerebras), `DiscoverResult`, `SignReference`, `Health` and error codes. The `MOCK=1` client mode comes with the API client PR
- [x] Stub for Durgesh: `apps/api/src/gloss/index.ts` with the `textToSigns` signature from PLAN §4.2 that returns dummy signs, so the API compiles from day one
- [ ] **Sponsor keys (see PLAN §2.2):** activate your $5 Cerebras credit and create the **production** Cerebras key; verify its actual paid/development quota in the dashboard and response headers; the personal free account observed 5 requests/min, while kickoff Developer numbers in PLAN §2.2 are assumptions to reconfirm. Create the **production** Exa key on the $100 credit. Put both in the team password manager and in the deploy's env variables only. Everyone else uses their own Cerebras dev key
- [ ] Turn on usage alerts in both dashboards if they offer them; note spend in the team chat at each checkpoint
- [x] PR checks: separate Lint, Type check, Tests and Build jobs, plus a rule that source changes need test changes (`no-tests-needed` label to skip)
- [x] `.env.example` (`CEREBRAS_API_KEY`, `CEREBRAS_MODEL`, `EXA_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, plus `ADMIN_SECRET` and rate limits), zod-validated `src/env.ts`, and an API README "how to run"
- [x] Branch protection on `main` (requires all five PR checks, branch up to date; admins exempt so you can still push directly)
- [ ] Post in the team chat: "Contracts are ready, start building."

## 2. Hours 1–6: Transcript

- [x] `apps/api/src/transcript.ts`: `getCaptions(videoId) → {start, end, text}[]` using `youtubei.js`. Prefer manual English captions, then auto-generated ones
- [x] Normalize: merge cues shorter than ~1s, split cues longer than ~8s at punctuation, decode HTML entities, remove `[Music]`-style tags
- [x] Clear errors: `NO_CAPTIONS`, `VIDEO_UNAVAILABLE`, `LIVE_NOT_SUPPORTED` → these go into `SignTrack.error` so Poonam and Hasan can show useful messages
  - Done as `getTranscript(videoId, source)` (also returns title, description and duration for Exa and the length limit). YouTube's WEB clients now return UNPLAYABLE with no caption tracks for server requests; the IOS and ANDROID clients return them, so `youtubeSource()` tries IOS → ANDROID → WEB. The `.vtt` parser for the manual upload is in `captions.ts`; the endpoint comes with the API routes PR
- [x] Manual-upload fallback: `POST /api/captions/:videoId` accepts a `.vtt` file (parse it with a small TS VTT parser), in case YouTube blocks the server IP
  - `POST /api/captions/:videoId?lang=&title=` takes a raw `.vtt` body or a form field `file`, needs the `x-admin-secret` header, and builds a `manual` track
- [x] **Exa video context** `apps/api/src/context.ts`: `getVideoContext(videoId, title, description) → VideoContext | undefined` (type from PLAN §4.2). Use Exa search with a schema, so Exa returns the structured result directly:
  ```ts
  import Exa from "exa-js";
  const exa = new Exa(); // reads EXA_API_KEY

  const res = await exa.search(`${title}. ${description.slice(0, 200)}`, {
    type: "auto",
    numResults: 5,
    systemPrompt:
      "Find background on this video's topic, people, places and technical terms.",
    outputSchema: videoContextJsonSchema, // made from the zod VideoContext schema
    contents: { highlights: true },
  });
  const ctx = VideoContextSchema.safeParse(res.output?.content);
  ```
  Cache it by `videoId`. If Exa fails, is slow (> 4s) or returns something invalid, return `undefined` and continue. **Glossing must never wait on Exa for long.** If `outputSchema` doesn't work in time, fall back to `highlights` only and let Durgesh's prompt read the excerpts
  - Done in `apps/api/src/exa.ts` together with the Discover and sign-reference search logic. Exa returns `output.content` as an object or a JSON string; both are handled. Invalid output falls back to the highlights as `topic`. Caching by `videoId` comes with the cache PR
- [x] Establish the five-video regression corpus and fetch captions for Durgesh
  - The user-selected official CS50 corpus is already fetched and attributed in `apps/api/src/gloss/word-priorities.json` (1,007 cues). Ayush still chooses presentation segments; see PLAN §10.
  - Live check (2026-11-01): all 5 CS50 videos return sorted, non-overlapping captions from YouTube through `getTranscript` (61–301 cues each)

## 3. Hours 6–12: API

- [x] Endpoints from PLAN §4.3, with every response validated by the shared zod schema
- [x] CORS: `https://www.youtube.com`, `chrome-extension://<id>`, the Vercel domain, `localhost`
- [x] Job pipeline: a cache miss → status `processing` → `getTranscript` → `getVideoContext` (Exa, bounded wait) → `textToSigns` (Durgesh's module, on Cerebras) → store → `ready`. Update `progress` after each batch. An in-memory job map is fine. Two requests for the same `videoId` must share one job, not start two
  - Done in `pipeline.ts` + `jobs.ts`. Change: Exa context starts once the transcript step has the video title (Exa needs it), so it runs after captions rather than in parallel; it is capped at 4s. Gloss runs in batches of 40 captions for progress. Error tracks are cached for 10 minutes; videos over `MAX_VIDEO_SECONDS` give `VIDEO_TOO_LONG`
- [x] Cache: key = `videoId:lang`, value = the `SignTrack` JSON. Add a `?refresh=1` admin flag (protected by a secret) to rebuild a track after Durgesh improves the prompt
- [x] `/api/signs`: reads Hasan's `packages/sign-assets/dictionary.json`
- [x] **`/api/discover?q=`** (Exa): `exa.search(q, { type: "auto", includeDomains: ["youtube.com"], numResults: 10, contents: { highlights: true } })` → keep only `/watch?v=` URLs, pull the `videoId` → return `{ videoId, title, url, snippet, thumbnail }[]` (snippet = first highlight; thumbnail = `https://i.ytimg.com/vi/<id>/hqdefault.jpg`). Stretch: mark which results have captions. Cache by query for 1 hour
- [x] **`/api/sign-reference?word=`** (Exa): `exa.search("how to sign " + word + " in ASL", { type: "auto", includeDomains: ["handspeak.com", "lifeprint.com", "signingsavvy.com", "signasl.org"], numResults: 3, contents: { highlights: true } })` → `{ title, url, source, highlight }[]`. Cache forever
- [x] `/api/health` reports whether the Cerebras and Exa keys work
  - Reports whether each key is **set**, not whether it works: a live check on every health call would spend credits. Run one real request after deploying instead
- [x] Rate limit (a simple per-IP counter, for example 20 new videos per hour) to protect the Cerebras and Exa credits; limit video length to ~15 min
- [ ] Deploy (Railway / Render / Fly, anywhere with a persistent disk for SQLite) and share the URL by **hour 10**
  - Ready: `apps/api/Dockerfile` (build from the repo root, volume at `/data`) and deploy steps in the API README. Needs your hosting account and the production keys
- [x] Swap the gloss stub for Durgesh's real module (hour 10) and test end-to-end on one demo video
  - Merged in PR #10; `services.ts` imports the real module. Historical real API/YouTube/Cerebras evidence is in `apps/api/src/gloss/live-results.json`; post-timing-fix full acceptance remains pending.
  - Local end-to-end run (2026-11-01) on Linear Search (`TwsgCHYmbbA`) with real Cerebras + Exa keys: `ready`, 61 segments, 364 signs, cached reload 13ms, `/vtt` export works. 100% fingerspelled because `dictionary.json` has 0 signs (#20); total 22s (Exa hit the 4s cap, one Cerebras 429 retry)

## 4. Hours 12–18: Hardening

- [ ] **Pre-warm the cache** for all 5 demo videos, and rebuild it after each change Durgesh makes to the prompt
  - Tool ready: `pnpm --filter @signstream/api demo warm <id...>` (and `demo refresh <id...>` after a prompt change). Run it once the demo videos and keys exist
- [x] Logging: one line per job (videoId, number of captions, number of signs, % fingerspelled, Exa time, **Cerebras time**, total time). Durgesh uses this for tuning
- [x] Stream partial results (stretch): mark the first N segments as ready so the avatar can start before the whole video is done
  - While `processing`, `/api/sign-track` returns the segments glossed so far (one batch of 40 captions at a time). Client: `getSignTrack(id, lang, { onPartial })` is called each time new segments arrive
- [ ] Help Ayush with integration bugs related to the API

## 5. Hours 18–20: Demo readiness

- [ ] Set up the API **locally on the demo laptop** with the cache pre-loaded (the offline backup)
  - Steps in the API README ("Offline demo laptop"): `demo import` then `dev`
- [ ] Pre-run the `/discover` queries Ayush will use in the demo, so they come from the cache
  - Tool ready: `demo discover "<query>"...`
- [ ] Pre-fetch `/api/sign-reference` for the 500 most common English words (~$5 of Exa credit) so `/signs` loads instantly
  - Tool ready: `demo sign-refs` (500 words in `src/scripts/common-words.ts`; cached words are skipped)
- [ ] Export the cached tracks as a JSON file in `mocks/demo-cache/` so they can be loaded with no network
  - Tool ready: `demo export` writes `mocks/demo-cache/cache.json`; `demo import` loads it on the demo laptop
- [x] API section of the README: endpoints, env variables, how to run (`apps/api/README.md`, plus demo-laptop and deploy steps)

---

## Handoffs

- **Gives everyone:** the monorepo, shared types, mock and API client (hour 1); the deployed API URL (hour 10).
- **Gives Durgesh:** a gloss stub to replace (hour 1); demo-video captions + Exa context (hour 4); job logs for tuning; `/api/sign-reference` (hour 11).
- **Gives Ayush:** `/api/discover` (hour 11).
- **Received from Durgesh:** merged `textToSigns`; next handoff is current quality/coverage/speed evidence and batch-boundary coordination.
- **Needs from Hasan:** `dictionary.json`, kept up to date.
- **Needs from Ayush:** confirmed presentation ranges and the separate full-video speed benchmark; use the already selected CS50 corpus for regression/cache work.

## Stretch

- Partial results (see §4)
- `GET /api/sign-track/:videoId/vtt`: export the gloss as a subtitle track (useful for learners)
  - Done: `?lang=ASL`, one cue per segment, fingerspelling shown as `fs-WORD`. It only serves existing tracks (404 `NOT_FOUND`, 409 `NOT_READY`), so it never starts a job or spends credits

## PR test cases

Every PR must pass these before review (tick them in the PR description). Also see the PR rules in PLAN §9.

- [x] `packages/shared`: zod schemas parse `mocks/sign-track.sample.json` without errors, and reject a track with a missing `segments` field
- [ ] `getCaptions` returns sorted, non-overlapping `{start, end, text}` for 2 demo videos; a video with no captions gives the `NO_CAPTIONS` error, not a crash
  - Covered by tests with fixtures (sorted, non-overlapping, `NO_CAPTIONS`); historical real Linear Search/Loops API runs are recorded by Durgesh; rerun current deployed behavior before marking this acceptance case complete
  - Live local run (2026-11-01): all 5 CS50 demo videos return sorted, non-overlapping captions; still needs the rerun on the deployed API
- [x] `GET /api/sign-track` on a new video returns `processing` with a `progress` value, then `ready`; two requests at once for the same video start only **one** job
- [x] A cached video returns in < 1s and makes **no** Cerebras or Exa call (check the logs)
- [x] With `EXA_API_KEY` removed, glossing still finishes (context is `undefined`)
- [x] `/api/discover` returns only YouTube `/watch` results; `/api/sign-reference` returns results only from the allowed sites
- [x] The rate limit returns HTTP 429 after the limit; no API key appears in any response or log

## Definition of done

- [ ] Everyone was building against your contracts by hour 1
- [ ] The API is deployed; cached demo videos load in < 1s; a new 3-minute video finishes in < 15s (Exa + Cerebras)
- [ ] `/api/discover` and `/api/sign-reference` work and are cached; Exa failures never break glossing
- [ ] Captions blocked → the manual `.vtt` upload works
- [ ] Cached API routes run locally on the demo laptop with no internet; YouTube playback itself still needs network, so use the recorded demo when fully offline

## Demo role

Explain the architecture in about 20s on the "How it works" slide, pointing out where Exa and Cerebras sit in the pipeline, and be ready to answer the judges' technical questions.

## Current integration work for your agent (R-I, 2026-11-01)

Read PLAN §§10–13. Preserve the merged implementation; these tasks extend it.
No new shared wire fields or player methods are required for the first gate.

| Task     | Implement / verify                                                                                                                                                                                 | Evidence required                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ ] R-I1 | Reconcile `services.ts`, pipeline, client and deploy branch with main; retain the real gloss import and current schemas                                                                            | Commit links; existing route/client tests pass without another scaffold                                                                                                  |
| [ ] R-I2 | Configure production Cerebras/Exa, persistent SQLite and HTTPS API; document quota tier, CORS/API origin, safe env locations and public health semantics                                           | One actual request per sponsor, redacted status/timing, deployed URL; health configured=true alone is insufficient                                                       |
| [ ] R-I3 | Coordinate outer 40-caption progress batches with Durgesh's 20/60 inner batches; enforce a shared provider request budget across simultaneous videos, retries and clients                          | Mocked multi-video quota tests; free-tier pacing is account-wide, not just concurrency=1 per invocation; no hidden fallback in timing evidence                           |
| [ ] R-I4 | Test sign windows at outer batch boundaries and overlapping source captions. The translator only sees each slice; clip overflow to the actual next caption before publishing a cumulative snapshot | Integration fixture spanning captions 39/40, gap=0/<0.5s, no overlapping emitted signs in either partial or final track; agree the smallest owner-local fix with Durgesh |
| [ ] R-I5 | Confirm cumulative `onPartial`, progress, final/error and AbortSignal behavior with both consumers. Document fresh-job vs cached data and ensure stale tab requests can be discarded               | Client/route tests; inspect emitted snapshots; preserve existing optional callbacks and schemas                                                                          |
| [ ] R-I6 | Refresh cached tracks after prompt, dictionary or timing changes. Coordinate API cache and extension session-cache eviction before demonstrations                                                  | Compare cold/refresh/warm runs; new dictionary keys appear in rebuilt tracks; exported cache records matching code/asset revisions in the run log                        |
| [ ] R-I7 | Exercise existing admin VTT fallback, cache warm/refresh/export/import and Exa degraded mode on demo laptop                                                                                        | Replay same snapshot with sponsor access disabled; no secrets in ZIP/client/report; distinguish cached API from offline YouTube playback                                 |
| [ ] R-I8 | Harden reference/discover requests and deployment errors using existing adapters rather than another search endpoint                                                                               | Actual allowlisted reference URLs and YouTube watch results; empty/error responses friendly; live failures remain separate from fixture assertions                       |

First handoff to Poonam/Hasan: API base URL, ASL/mock mode instructions, example
ready/processing/error payloads, partial snapshot semantics and origin settings.
Use `createApiClient` from `@signstream/shared`; callbacks cannot be serialized
across extension messages, so Poonam's worker must emit serializable snapshots
or serve individual polling requests. Do not put sponsor/admin credentials in
host configuration. Existing CLI commands are documented in `apps/api/README.md`;
run them intentionally on the designated account and report whether cache was used.

### Additional PR test cases

- [ ] Simultaneous different videos plus 429 retries obey one account-wide request budget.
- [ ] Full-track timing remains valid at the API's 40-caption boundary, including partial snapshots.
- [ ] Dictionary/prompt refresh replaces stale API and host caches in the demonstration path.
- [ ] Cached API responses are <1s and sponsor-free on the actual deployment/laptop; cold totals and gloss-only times are recorded separately.
