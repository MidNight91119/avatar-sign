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

---

## 1. Hour 0–1: Unblock everyone (top priority)

- [x] Turborepo + pnpm monorepo: `apps/{api,extension,web}`, `packages/{player,sign-assets,shared,ui,typescript-config,eslint-config}`, strict TS, ESLint + Prettier, Bun for the API and tests, root scripts (`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm pr-check`)
- [x] `packages/shared`: zod schemas + TS types from PLAN §4.1 (`SignTrack`, `Segment`, `Sign`, `SignLang`). Export the types with `z.infer` so they can't drift from the schemas
- [x] `packages/shared`: a typed API client (also `discover`, `signReference`, `health`, `ApiClientError`, and `mock: true` / `MOCK=1` mode):
  ```ts
  createApiClient({ baseUrl })
    .getSignTrack(videoId, lang, { onProgress })  // polls every 2s until "ready" or "error"
    .getSigns(lang)                               // string[]
  ```
- [x] `mocks/sign-track.sample.json`: about 60s of a real video, written by hand, with real glosses (`HELLO`, `MY`, `NAME`, `FS:...`). Add a `MOCK=1` mode to the client that returns the mock, so Hasan and Poonam can build before the API exists
  - Done: zod schemas also cover `Caption`, `VideoContext` (+ JSON schema for Exa/Cerebras), `DiscoverResult`, `SignReference`, `Health` and error codes. The `MOCK=1` client mode comes with the API client PR
- [x] Stub for Durgesh: `apps/api/src/gloss/index.ts` with the `textToSigns` signature from PLAN §4.2 that returns dummy signs, so the API compiles from day one
- [ ] **Sponsor keys (see PLAN §2.2):** activate your $5 Cerebras credit and create the **production** Cerebras key; make sure the account is on the **Developer tier** (1,000 requests/min) and not the free trial (5 requests/min). Create the **production** Exa key on the $100 credit. Put both in the team password manager and in the deploy's env variables only. Everyone else uses their own Cerebras dev key
- [ ] Turn on usage alerts in both dashboards if they offer them; note spend in the team chat at each checkpoint
- [x] PR checks: separate Lint, Type check, Tests and Build jobs, plus a rule that source changes need test changes (`no-tests-needed` label to skip)
- [x] `.env.example` (`CEREBRAS_API_KEY`, `CEREBRAS_MODEL`, `EXA_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, plus `ADMIN_SECRET` and rate limits), zod-validated `src/env.ts`, and an API README "how to run"
- [ ] Branch protection on `main` (requires all five PR checks)
- [ ] Post in the team chat: "Contracts are ready, start building."

## 2. Hours 1–6: Transcript

- [x] `apps/api/src/transcript.ts`: `getCaptions(videoId) → {start, end, text}[]` using `youtubei.js`. Prefer manual English captions, then auto-generated ones
- [x] Normalize: merge cues shorter than ~1s, split cues longer than ~8s at punctuation, decode HTML entities, remove `[Music]`-style tags
- [x] Clear errors: `NO_CAPTIONS`, `VIDEO_UNAVAILABLE`, `LIVE_NOT_SUPPORTED` → these go into `SignTrack.error` so Poonam and Hasan can show useful messages
  - Done as `getTranscript(videoId, source)` (also returns title, description and duration for Exa and the length limit). YouTube's WEB clients now return UNPLAYABLE with no caption tracks for server requests; the IOS and ANDROID clients return them, so `youtubeSource()` tries IOS → ANDROID → WEB. The `.vtt` parser for the manual upload is in `captions.ts`; the endpoint comes with the API routes PR
- [ ] Manual-upload fallback: `POST /api/captions/:videoId` accepts a `.vtt` file (parse it with a small TS VTT parser), in case YouTube blocks the server IP
- [x] **Exa video context** `apps/api/src/context.ts`: `getVideoContext(videoId, title, description) → VideoContext | undefined` (type from PLAN §4.2). Use Exa search with a schema, so Exa returns the structured result directly:
  ```ts
  import Exa from "exa-js";
  const exa = new Exa(); // reads EXA_API_KEY

  const res = await exa.search(`${title}. ${description.slice(0, 200)}`, {
    type: "auto",
    numResults: 5,
    systemPrompt: "Find background on this video's topic, people, places and technical terms.",
    outputSchema: videoContextJsonSchema, // made from the zod VideoContext schema
    contents: { highlights: true },
  });
  const ctx = VideoContextSchema.safeParse(res.output?.content);
  ```
  Cache it by `videoId`. If Exa fails, is slow (> 4s) or returns something invalid, return `undefined` and continue. **Glossing must never wait on Exa for long.** If `outputSchema` doesn't work in time, fall back to `highlights` only and let Durgesh's prompt read the excerpts
  - Done in `apps/api/src/exa.ts` together with the Discover and sign-reference search logic. Exa returns `output.content` as an object or a JSON string; both are handled. Invalid output falls back to the highlights as `topic`. Caching by `videoId` comes with the cache PR
- [ ] Ayush picks the **5 demo videos** by hour 3. Fetch their captions and send them to Durgesh by **hour 4**

## 3. Hours 6–12: API

- [ ] Endpoints from PLAN §4.3, with every response validated by the shared zod schema
- [ ] CORS: `https://www.youtube.com`, `chrome-extension://<id>`, the Vercel domain, `localhost`
- [x] Job pipeline: a cache miss → status `processing` → `getCaptions` + `getVideoContext` (Exa) in parallel → `textToSigns` (Durgesh's module, on Cerebras) → store → `ready`. Update `progress` after each batch. An in-memory job map is fine. Two requests for the same `videoId` must share one job, not start two
  - Done in `pipeline.ts` + `jobs.ts`. Change: Exa context starts once the transcript step has the video title (Exa needs it), so it runs after captions rather than in parallel; it is capped at 4s. Gloss runs in batches of 40 captions for progress. Error tracks are cached for 10 minutes; videos over `MAX_VIDEO_SECONDS` give `VIDEO_TOO_LONG`
- [x] Cache: key = `videoId:lang`, value = the `SignTrack` JSON. Add a `?refresh=1` admin flag (protected by a secret) to rebuild a track after Durgesh improves the prompt
- [ ] `/api/signs`: reads Hasan's `packages/sign-assets/dictionary.json`
- [ ] **`/api/discover?q=`** (Exa): `exa.search(q, { type: "auto", includeDomains: ["youtube.com"], numResults: 10, contents: { highlights: true } })` → keep only `/watch?v=` URLs, pull the `videoId` → return `{ videoId, title, url, snippet, thumbnail }[]` (snippet = first highlight; thumbnail = `https://i.ytimg.com/vi/<id>/hqdefault.jpg`). Stretch: mark which results have captions. Cache by query for 1 hour
- [ ] **`/api/sign-reference?word=`** (Exa): `exa.search("how to sign " + word + " in ASL", { type: "auto", includeDomains: ["handspeak.com", "lifeprint.com", "signingsavvy.com", "signasl.org"], numResults: 3, contents: { highlights: true } })` → `{ title, url, source, highlight }[]`. Cache forever
- [ ] `/api/health` reports whether the Cerebras and Exa keys work
- [ ] Rate limit (a simple per-IP counter, for example 20 new videos per hour) to protect the Cerebras and Exa credits; limit video length to ~15 min
- [ ] Deploy (Railway / Render / Fly, anywhere with a persistent disk for SQLite) and share the URL by **hour 10**
- [ ] Swap the gloss stub for Durgesh's real module (hour 10) and test end-to-end on one demo video

## 4. Hours 12–18: Hardening

- [ ] **Pre-warm the cache** for all 5 demo videos, and rebuild it after each change Durgesh makes to the prompt
- [x] Logging: one line per job (videoId, number of captions, number of signs, % fingerspelled, Exa time, **Cerebras time**, total time). Durgesh uses this for tuning
- [ ] Stream partial results (stretch): mark the first N segments as ready so the avatar can start before the whole video is done
- [ ] Help Ayush with integration bugs related to the API

## 5. Hours 18–20: Demo readiness

- [ ] Set up the API **locally on the demo laptop** with the cache pre-loaded (the offline backup)
- [ ] Pre-run the `/discover` queries Ayush will use in the demo, so they come from the cache
- [ ] Pre-fetch `/api/sign-reference` for the 500 most common English words (~$5 of Exa credit) so `/signs` loads instantly
- [ ] Export the cached tracks as a JSON file in `mocks/demo-cache/` so they can be loaded with no network
- [ ] API section of the README: endpoints, env variables, how to run

---

## Handoffs
- **Gives everyone:** the monorepo, shared types, mock and API client (hour 1); the deployed API URL (hour 10).
- **Gives Durgesh:** a gloss stub to replace (hour 1); demo-video captions + Exa context (hour 4); job logs for tuning; `/api/sign-reference` (hour 11).
- **Gives Ayush:** `/api/discover` (hour 11).
- **Needs from Durgesh:** the real `textToSigns` module (hour 10).
- **Needs from Hasan:** `dictionary.json`, kept up to date.
- **Needs from Ayush:** the list of 5 demo videos (hour 3).

## Stretch
- Partial results (see §4)
- `GET /api/sign-track/:videoId/vtt`: export the gloss as a subtitle track (useful for learners)

## PR test cases
Every PR must pass these before review (tick them in the PR description). Also see the PR rules in PLAN §9.

- [ ] `packages/shared`: zod schemas parse `mocks/sign-track.sample.json` without errors, and reject a track with a missing `segments` field
- [ ] `getCaptions` returns sorted, non-overlapping `{start, end, text}` for 2 demo videos; a video with no captions gives the `NO_CAPTIONS` error, not a crash
- [ ] `GET /api/sign-track` on a new video returns `processing` with a `progress` value, then `ready`; two requests at once for the same video start only **one** job
- [ ] A cached video returns in < 1s and makes **no** Cerebras or Exa call (check the logs)
- [ ] With `EXA_API_KEY` removed, glossing still finishes (context is `undefined`)
- [ ] `/api/discover` returns only YouTube `/watch` results; `/api/sign-reference` returns results only from the allowed sites
- [ ] The rate limit returns HTTP 429 after the limit; no API key appears in any response or log

## Definition of done
- [ ] Everyone was building against your contracts by hour 1
- [ ] The API is deployed; cached demo videos load in < 1s; a new 3-minute video finishes in < 15s (Exa + Cerebras)
- [ ] `/api/discover` and `/api/sign-reference` work and are cached; Exa failures never break glossing
- [ ] Captions blocked → the manual `.vtt` upload works
- [ ] The API runs locally on the demo laptop with no internet

## Demo role
Explain the architecture in about 20s on the "How it works" slide, pointing out where Exa and Cerebras sit in the pipeline, and be ready to answer the judges' technical questions.
