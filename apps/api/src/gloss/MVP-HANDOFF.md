# Immediate demo handoff

The initial Durgesh implementation in PR #24 is merged. The current bridge adds
733 registered procedural signs and preserves digits. It does not complete
playable coverage or prove human-readable signing. Reuse the existing API/cache
commands below; no new service, queue or transcription subsystem is needed.

## Ready on this machine

- Latest main is integrated through PR #30 (`9462407`). The refreshed Linear
  Search cache now contains **202/346 native signs (58.38%)**, 61 segments,
  zero fallback, **7.936s** total using cached Exa context. Historical measurements
  below used the empty dictionary and are retained as the baseline.
- The extension was visually verified on actual YouTube playback: hand poses,
  captions and glosses advanced from 01:17 to 01:35. Build it with
  `VITE_API_URL=http://localhost:8787 pnpm --filter @signstream/extension build`.
  The unpacked extension directory is `apps/extension/dist`; its name is now
  **signside**. Click its toolbar icon, then **Start sign language**.
- Website: `http://localhost:3000/watch?v=TwsgCHYmbbA`; API: localhost port 8787.
  The production website build uses `NEXT_PUBLIC_API_URL=http://localhost:8787`.
  The website now creates its privacy-enhanced iframe directly before attaching
  the media clock API. The actual CS50 player loads, replacing the black frame.

- The full Linear Search video (`TwsgCHYmbbA`, 2:50) was prepared using the real
  YouTube → Exa → Cerebras → API job pipeline: **8.658s**, 61 segments,
  378 signs, two provider calls, zero fallback, context present.
- Its ready track was fetched through actual localhost HTTP and the shared
  client in **22.76ms**, with zero new jobs/job logs. This is a cached response,
  not another inference measurement.
- The private SQLite cache and export are in ignored `data/mvp-demo.sqlite` and
  `data/mvp-demo-cache.json` under this directory. No raw captions/cache are
  committed. Refresh after changing prompt/dictionary.
- The new deterministic HTTP integration test covers 40-segment partial output,
  final readiness through shared-client polling and cache reuse without another
  provider call. Providers are mocked in CI.

See [mvp-readiness.json](./mvp-readiness.json) for the sanitized measurements.
The separate full 3:33 speed benchmark remains in `acceptance-results.json`;
Linear Search does not replace that >=180-second benchmark.

## Start the existing API

Run from the repository root on the acceptance branch, with the ignored root
`.env` already configured. No key belongs in frontend settings or the extension.

```sh
DATABASE_URL=./apps/api/src/gloss/data/mvp-demo.sqlite \
  bun --env-file=.env apps/api/src/index.ts
```

Poonam's PR #22 defaults to `http://localhost:8787`. Check
`/api/sign-track?videoId=TwsgCHYmbbA&lang=ASL`; the current cache returns `ready`.
`/api/health` only confirms configured credentials; the live job above is the
provider-authentication evidence. Do not expose the local API publicly.

If the dictionary/prompt changes, stop the API briefly and rebuild its track:

```sh
DATABASE_URL=./apps/api/src/gloss/data/mvp-demo.sqlite \
  bun --env-file=.env apps/api/src/scripts/demo.ts refresh TwsgCHYmbbA
DATABASE_URL=./apps/api/src/gloss/data/mvp-demo.sqlite \
  bun --env-file=.env apps/api/src/scripts/demo.ts export \
  apps/api/src/gloss/data/mvp-demo-cache.json
```

For a clean laptop, copy the private export securely and use the existing
`demo import <file>` command with the chosen local database. Cached API data
can work offline; YouTube playback still needs a network or a backup recording.

## Historical blockers before the bridge

Before this bridge, main had an empty animation dictionary. Hasan's published
`hasan/signside-player` branch contains a procedural WebGL player and **733**
lexicon entries, so it does not need hundreds of downloaded clip files. However:

1. Those definitions are not registered in `dictionary.json`; the real backend
   therefore still emits 100% fingerspelling with main's runtime dictionary.
2. That player currently drops digits in `FS:23` / mixed letter-number tokens.
3. A live compatibility probe against its unmerged vocabulary reached **52.62%**
   native signs on Linear Search, not 70%. A nonempty dictionary alone does not
   close #17; further technical vocabulary/readability work is required.
4. The player branch has not been integrated/render-tested here. Poonam's current
   extension PR accurately labels its text placeholder until a player is present.

The approved bridge above resolves registration, digit dropping and basic
rendered integration. Native coverage is still below 70%; human signing review
and the broader clock/control matrix remain open.

## Smallest stage path

Use Ayush's proposed Linear Search backup range **15.03–91.72 seconds** from
PR #23 for a short demonstration, while retaining the full cached source track.
The intended Loops stage segment remains his primary proposal; this backup does
not overwrite the shared list. `mvp-readiness.json` ranks the actual output words
in the backup range for Hasan. Prioritize real supported signs and readable
fingerspelling; preserve names, numbers and negation rather than hiding them to
raise a coverage percentage.

Before calling the avatar demo ready: merge/rebase the owned PRs, refresh cache
against the actual vocabulary, load the unpacked extension, and check pause,
backward seek, 0.5×/2×, fullscreen and the numeric examples. Human signing review
and the >=70% full-corpus gate remain separate from clock synchronization.
