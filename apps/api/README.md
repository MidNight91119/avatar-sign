# @signstream/api

Owner: **Raashed** · Spec: [specs/raashed.md](../../specs/raashed.md)

Hono API running on **Bun**. `src/gloss/` belongs to Durgesh.

## Run it

```sh
cp .env.example apps/api/.env      # then fill in your own dev keys
pnpm --filter @signstream/api dev  # bun --watch src/index.ts → http://localhost:8787
pnpm --filter @signstream/api test # bun test
```

Without `CEREBRAS_API_KEY` or `EXA_API_KEY` the API still runs: glossing falls back to the gloss module's rule-only path and Exa features are skipped.

## Environment

Validated with zod in `src/env.ts`; see `.env.example` at the repo root for every variable. Keys are never logged (`describeEnv` prints only "set" or "missing").

## Endpoints

All responses are JSON and match the zod schemas in `@signstream/shared` (PLAN §4.3). Errors look like `{ "error": "CODE", "message": "..." }`.

| Method | Path | Returns | Notes |
|---|---|---|---|
| `GET` | `/api/health` | `{ ok, cerebras, exa }` | Whether each key is **set** (not a paid live check) |
| `GET` | `/api/sign-track?videoId=&lang=ASL` | `SignTrack` | Cached → instant. New → starts one shared job and returns `processing` with `progress` and the segments done so far; poll every 2s. Errors: `NO_CAPTIONS`, `VIDEO_UNAVAILABLE`, `LIVE_NOT_SUPPORTED`, `VIDEO_TOO_LONG`, `GLOSS_FAILED`, `INTERNAL` |
| `GET` | `/api/sign-track?...&refresh=1` | `SignTrack` | Rebuilds a cached track. Needs header `x-admin-secret` |
| `GET` | `/api/sign-track/:videoId/vtt?lang=ASL` | `text/vtt` | The gloss as a subtitle track (fingerspelling shown as `fs-WORD`). Only for existing tracks: 404 `NOT_FOUND` if none, 409 `NOT_READY` while processing; never starts a job |
| `POST` | `/api/captions/:videoId?lang=&title=` | `SignTrack` (202) | Manual `.vtt` upload (raw body or form field `file`) when YouTube blocks the server. Needs `x-admin-secret` |
| `GET` | `/api/signs?lang=ASL` | `string[]` | Glosses in `packages/sign-assets/dictionary.json` (reloaded when it changes) |
| `GET` | `/api/discover?q=` | `DiscoverResult[]` | Exa, YouTube `/watch` videos only; cached 1 hour; 503 `EXA_DISABLED` without a key |
| `GET` | `/api/sign-reference?word=` | `SignReference[]` | Exa, handspeak/lifeprint/signingsavvy/signasl only, and only pages that name the word; cached forever |

**Exa errors (both routes):** 504 `UPSTREAM_TIMEOUT` after 8s, 503 `UPSTREAM_BUSY` with `Retry-After: 60` when Exa rate-limits us, 502 `UPSTREAM_ERROR` otherwise. Failures are never cached; empty answers are cached for 5 minutes only. Identical requests that arrive together share one Exa call. Highlights and snippets are cut to ~280 characters.

**Limits (per IP, per hour):** `RATE_LIMIT_NEW_VIDEOS_PER_HOUR` new videos and `RATE_LIMIT_DISCOVER_PER_HOUR` uncached searches → `429 RATE_LIMITED`. Videos longer than `MAX_VIDEO_SECONDS` → `VIDEO_TOO_LONG`.

## For the extension and website (client semantics)

Use `createApiClient` from `@signstream/shared`. `getSignTrack(videoId, lang, { onProgress, onPartial, signal })`:

- **Cached track:** the first request returns `ready`. `onProgress(1)` is called once and `onPartial` is never called. Use the returned track.
- **New video:** returns `processing` and the client polls every 2s. `onPartial(track)` fires each time new segments arrive. Each partial is a **cumulative snapshot**: it holds every segment so far, in order, so replace your schedule instead of appending. Signs in a partial never change in the final track (they're clipped to the next caption that isn't glossed yet). Ahead of the prepared data, show idle/preparing.
- **Error after partials:** the result is `{ status: "error", error, segments: [] }`. Drop the partial schedule and show the error message.
- **Stale requests:** pass an `AbortSignal` and abort it on navigation or a new video. The client stops polling, cancels the in-flight fetch and fires no more callbacks. Always check the `videoId` of what comes back before applying it.
- Callbacks can't cross extension messages. The worker should send serializable snapshots, or the content script should make short polling requests itself. No keys or `ADMIN_SECRET` belong in any host.

## Provider budget (Cerebras)

Every Cerebras call from every job, retry and client goes through one account-wide budget (`src/provider-budget.ts`). It enforces requests per minute, requests per hour, **tokens per minute** and calls in flight. Each call is charged an estimate up front, then its real `usage.total_tokens`. A 429 pauses new calls for everyone (`Retry-After`, else 2s).

| `CEREBRAS_TIER` | Requests/min | Requests/hour | Tokens/min | In flight |
|---|---|---|---|---|
| `free` | 5 | 150 | 30,000 | 1 |
| *(blank = paid)* | 60 | – | – | 4 |

The free numbers come from the `x-ratelimit-*` headers of a real key (2026-11-01; the daily limit is 2,400 requests). Check a paid key the same way before relying on the paid defaults. Override with `CEREBRAS_REQUESTS_PER_MINUTE`, `CEREBRAS_TOKENS_PER_MINUTE` and `CEREBRAS_MAX_CONCURRENT`. **On the free tier the token limit binds first:** a 40-caption batch uses about 5k tokens, so about 6 batches fit in a minute. The gloss module also reads `CEREBRAS_TIER`: `free` gives 60-caption inner batches, one at a time; otherwise it uses 20-caption batches with up to 4 per video. The API sends 40 captions per call for progress.

**Measured (2026-11-01, free key, `CEREBRAS_TIER=free`, fresh cache):** Linear Search (2:50, 61 cues) and Binary Search (9:31, 202 cues) glossed **at the same time**. Without the token cap: 6 rate-limit errors (429), 297s total. With it: **0 errors (429s), 0 fallbacks, 77s**. Linear Search on its own: 15.4s cold (4.8s gloss, 4.0s Exa hitting its cap). Cached reloads: 13–14 ms.

**CORS:** `youtube.com`, any `chrome-extension://`, `localhost`, plus `ALLOWED_ORIGINS` (add the Vercel URL there).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `CEREBRAS_API_KEY` | – | Gloss translation (Durgesh's module) |
| `CEREBRAS_MODEL` | `gpt-oss-120b` | Or `qwen-3.8-27b` |
| `EXA_API_KEY` | – | Video context, Discover, sign references. Without it those features are off and glossing still works |
| `DATABASE_URL` | `./data/signstream.sqlite` | SQLite cache file |
| `ALLOWED_ORIGINS` | – | Extra CORS origins, comma separated |
| `ADMIN_SECRET` | – | Enables `?refresh=1` and `.vtt` uploads |
| `RATE_LIMIT_NEW_VIDEOS_PER_HOUR` | `20` | Per IP |
| `RATE_LIMIT_DISCOVER_PER_HOUR` | `30` | Per IP |
| `MAX_VIDEO_SECONDS` | `900` | 15 minutes |
| `CEREBRAS_TIER` | – | `free` for free-trial pacing (see Provider budget) |
| `CEREBRAS_REQUESTS_PER_MINUTE` / `CEREBRAS_TOKENS_PER_MINUTE` / `CEREBRAS_MAX_CONCURRENT` | per tier | Override the account-wide budget |

## Demo readiness

```sh
pnpm --filter @signstream/api demo warm <videoId...>      # build tracks for the demo videos
pnpm --filter @signstream/api demo refresh <videoId...>   # rebuild after a prompt change
pnpm --filter @signstream/api demo stale                  # tracks built with an older gloss module, dictionary or model
pnpm --filter @signstream/api demo refresh --stale        # rebuild exactly those
pnpm --filter @signstream/api demo discover "volcanoes"   # pre-run demo searches
pnpm --filter @signstream/api demo sign-refs              # 500 common words (~$5 of Exa credit)
pnpm --filter @signstream/api demo export                 # → mocks/demo-cache/cache.json (warns about stale tracks)
```

Every ready track records what built it: a hash of the gloss module's source, a hash of the dictionary, and the model. The export writes these per track, plus the commit, so the run log shows exactly what the demo cache was built from. After Hasan adds clips or Durgesh changes the prompt, run `demo stale` and then `demo refresh --stale`. The extension also keeps tracks in `chrome.storage.session`, so ask Poonam to clear that before the demo.

**Offline demo laptop:** `pnpm install`, then `pnpm --filter @signstream/api demo import` and `pnpm --filter @signstream/api dev`. Cached videos, searches and sign references are served with no internet.

## Deploy

Any host with a persistent disk (Railway, Render, Fly). Build from the repo root with `apps/api/Dockerfile`, mount a volume at `/data`, set the variables above (production keys only here, PLAN §2.2), and add the website URL to `ALLOWED_ORIGINS`. Then:

```sh
curl https://<api-host>/api/health   # → {"ok":true,"cerebras":true,"exa":true}
```
