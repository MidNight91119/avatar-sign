# @signstream/api

Owner: **Raashed** · Spec: [specs/raashed.md](../../specs/raashed.md)

Hono API running on **Bun**. `src/gloss/` belongs to Durgesh.

## Run it

```sh
cp .env.example apps/api/.env      # then fill in your own dev keys
pnpm --filter @signstream/api dev  # bun --watch src/index.ts → http://localhost:8787
pnpm --filter @signstream/api test # bun test
```

Without `CEREBRAS_API_KEY` or `EXA_API_KEY` the API still runs: glossing uses the placeholder and Exa features are skipped.

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
| `GET` | `/api/sign-reference?word=` | `SignReference[]` | Exa, handspeak/lifeprint/signingsavvy/signasl only; cached forever |

**Limits (per IP, per hour):** `RATE_LIMIT_NEW_VIDEOS_PER_HOUR` new videos and `RATE_LIMIT_DISCOVER_PER_HOUR` uncached searches → `429 RATE_LIMITED`. Videos longer than `MAX_VIDEO_SECONDS` → `VIDEO_TOO_LONG`.

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

## Demo readiness

```sh
pnpm --filter @signstream/api demo warm <videoId...>      # build tracks for the demo videos
pnpm --filter @signstream/api demo refresh <videoId...>   # rebuild after a prompt change
pnpm --filter @signstream/api demo discover "volcanoes"   # pre-run demo searches
pnpm --filter @signstream/api demo sign-refs              # 500 common words (~$5 of Exa credit)
pnpm --filter @signstream/api demo export                 # → mocks/demo-cache/cache.json
```

**Offline demo laptop:** `pnpm install`, then `pnpm --filter @signstream/api demo import` and `pnpm --filter @signstream/api dev`. Cached videos, searches and sign references are served with no internet.

## Deploy

Any host with a persistent disk (Railway, Render, Fly). Build from the repo root with `apps/api/Dockerfile`, mount a volume at `/data`, set the variables above (production keys only here, PLAN §2.2), and add the website URL to `ALLOWED_ORIGINS`. Then:

```sh
curl https://<api-host>/api/health   # → {"ok":true,"cerebras":true,"exa":true}
```
