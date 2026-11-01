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
