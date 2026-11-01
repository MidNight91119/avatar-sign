# Immediate demo handoff

The Durgesh implementation is in PR #24, ready for review. It does not complete
playable coverage or prove human-readable signing. Reuse the existing API/cache
commands below; no new service, queue or transcription subsystem is needed.

## Ready on this machine

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

## The remaining product blocker

Main still has an empty animation dictionary. Hasan's newly published
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

The user explicitly approved the focused vocabulary/digit bridge under
`AGENTS.md`; it is being prepared as a small follow-up against Hasan's player
branch so his renderer work is not duplicated.
Do not label the placeholder or empty dictionary a completed signing MVP.

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
