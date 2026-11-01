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
Node.js 20+, Hono (`@hono/node-server`), `youtubei.js`, **`exa-js`** (sponsor), `zod`, `better-sqlite3` (or Upstash Redis on serverless), `p-limit`, Vitest.

---

## 1. Hour 0–1: Unblock everyone (top priority)

- [ ] `pnpm` monorepo: `apps/{api,extension,web}`, `packages/{player,sign-assets,shared}`, `tsconfig.base.json` (strict), Biome, Vitest, root scripts (`pnpm dev`, `pnpm build`, `pnpm test`)
- [ ] `packages/shared`: zod schemas + TS types from PLAN §4.1 (`SignTrack`, `Segment`, `Sign`, `SignLang`). Export the types with `z.infer` so they can't drift from the schemas
- [ ] `packages/shared`: a typed API client:
  ```ts
  createApiClient({ baseUrl })
    .getSignTrack(videoId, lang, { onProgress })  // polls every 2s until "ready" or "error"
    .getSigns(lang)                               // string[]
  ```
- [ ] `mocks/sign-track.sample.json`: about 60s of a real video, written by hand, with real glosses (`HELLO`, `MY`, `NAME`, `FS:...`). Add a `MOCK=1` mode to the client that returns the mock, so Hasan and Poonam can build before the API exists
- [ ] Stub for Durgesh: `apps/api/src/gloss/index.ts` with the `textToSigns` signature from PLAN §4.2 that returns dummy signs, so the API compiles from day one
- [ ] Get the **Cerebras** and **Exa** API keys/credits from the sponsors at kickoff and share them in the team password manager
- [ ] `.env.example` (`CEREBRAS_API_KEY`, `CEREBRAS_MODEL`, `EXA_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`), a short README "how to run", and branch protection on `main`
- [ ] Post in the team chat: "Contracts are ready, start building."

## 2. Hours 1–6: Transcript

- [ ] `apps/api/src/transcript.ts`: `getCaptions(videoId) → {start, end, text}[]` using `youtubei.js`. Prefer manual English captions, then auto-generated ones
- [ ] Normalize: merge cues shorter than ~1s, split cues longer than ~8s at punctuation, decode HTML entities, remove `[Music]`-style tags
- [ ] Clear errors: `NO_CAPTIONS`, `VIDEO_UNAVAILABLE`, `LIVE_NOT_SUPPORTED` → these go into `SignTrack.error` so Poonam and Hasan can show useful messages
- [ ] Manual-upload fallback: `POST /api/captions/:videoId` accepts a `.vtt` file (parse it with a small TS VTT parser), in case YouTube blocks the server IP
- [ ] **Exa video context** `apps/api/src/context.ts`: `getVideoContext(videoId, title) → string`. Run `exa.searchAndContents(title, { numResults: 3, text: { maxCharacters: 1500 }, excludeDomains: ["youtube.com"] })` and join the results into a short background text (topic, names, terms). Cache it by `videoId`. If Exa fails or is slow (> 3s), return `""` and continue
- [ ] Ayush picks the **5 demo videos** by hour 3. Fetch their captions and send them to Durgesh by **hour 4**

## 3. Hours 6–12: API

- [ ] Endpoints from PLAN §4.3, with every response validated by the shared zod schema
- [ ] CORS: `https://www.youtube.com`, `chrome-extension://<id>`, the Vercel domain, `localhost`
- [ ] Job pipeline: a cache miss → status `processing` → `getCaptions` + `getVideoContext` (Exa) in parallel → `textToSigns` (Durgesh's module, on Cerebras) → store → `ready`. Update `progress` after each batch. An in-memory job map is fine. Two requests for the same `videoId` must share one job, not start two
- [ ] Cache: key = `videoId:lang`, value = the `SignTrack` JSON. Add a `?refresh=1` admin flag (protected by a secret) to rebuild a track after Durgesh improves the prompt
- [ ] `/api/signs`: reads Hasan's `packages/sign-assets/dictionary.json`
- [ ] **`/api/discover?q=`** (Exa): `exa.search(q + " explained", { includeDomains: ["youtube.com"], numResults: 10 })` → pull the `videoId` from each URL → return `{ videoId, title, url, snippet, thumbnail }[]`. Stretch: mark which results have captions. Cache by query for 1 hour
- [ ] **`/api/sign-reference?word=`** (Exa): `exa.search("how to sign " + word + " in ASL", { includeDomains: ["handspeak.com", "lifeprint.com", "signingsavvy.com", "signasl.org"], numResults: 3 })` → `{ title, url, source }[]`. Cache forever
- [ ] `/api/health` reports whether the Cerebras and Exa keys work
- [ ] Rate limit (a simple per-IP counter, for example 20 new videos per hour) to protect the Cerebras and Exa credits; limit video length to ~15 min
- [ ] Deploy (Railway / Render / Fly, anywhere with a persistent disk for SQLite) and share the URL by **hour 10**
- [ ] Swap the gloss stub for Durgesh's real module (hour 10) and test end-to-end on one demo video

## 4. Hours 12–18: Hardening

- [ ] **Pre-warm the cache** for all 5 demo videos, and rebuild it after each change Durgesh makes to the prompt
- [ ] Logging: one line per job (videoId, number of captions, number of signs, % fingerspelled, Exa time, **Cerebras time**, total time). Durgesh uses this for tuning
- [ ] Stream partial results (stretch): mark the first N segments as ready so the avatar can start before the whole video is done
- [ ] Help Ayush with integration bugs related to the API

## 5. Hours 18–20: Demo readiness

- [ ] Set up the API **locally on the demo laptop** with the cache pre-loaded (the offline backup)
- [ ] Pre-run the `/discover` queries Ayush will use in the demo, so they come from the cache
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

## Definition of done
- [ ] Everyone was building against your contracts by hour 1
- [ ] The API is deployed; cached demo videos load in < 1s; a new 3-minute video finishes in < 15s (Exa + Cerebras)
- [ ] `/api/discover` and `/api/sign-reference` work and are cached; Exa failures never break glossing
- [ ] Captions blocked → the manual `.vtt` upload works
- [ ] The API runs locally on the demo laptop with no internet

## Demo role
Explain the architecture in about 20s on the "How it works" slide, pointing out where Exa and Cerebras sit in the pipeline,, and be ready to answer the judges' technical questions.
