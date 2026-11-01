# Durgesh spec verification

Independent verification was requested for PR #10 on 2026-11-01. The complete
spec is **not yet satisfied**. This table distinguishes implemented behavior
from acceptance evidence that requires external inputs.

| Task | Implementation and automated evidence                                                                                              | Remaining acceptance evidence                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1   | Grammar prompt, five examples, dictionary/context instructions and source links                                                    | Complete                                                                                                     |
| D2   | 200 measured priorities from five official CS50 shorts / 1,007 actual caption segments                                             | Complete; word list and source links ready for Hasan                                                         |
| D3   | SDK/schema/retry tests and live two-model comparison; both 7/10 exact matches, GPT 1.4s vs Qwen 7.1s                               | Comparison complete; GPT selected; remaining strict linguistic cases disclosed                               |
| D4   | Synonyms, FS fallback, numbers in phrase tokens, decimal/sign/percentage handling and straight/curly contraction tests             | Complete for the documented post-pass                                                                        |
| D5   | Weighted timing, filler removal, bounded gap overflow, centring and non-overlap tests, including overlapping long captions         | Dense captions can require sub-0.25s signs; corpus acceptance rejects these until content/pacing is reviewed |
| D6   | Real YouTube/API/Cerebras runs: full Linear Search and Loops, plus a manual 180-second caption excerpt; shared track validation    | Module/API integration complete; avatar playback still depends on Hasan                                      |
| D6b  | Live paired context tests correct Java/coffee and Mauna Loa spelling; 4/5 exact matches after correcting word-boundary expectation | Crane case remains a mismatch; Exa fetch itself was not exercised                                            |
| D6c  | Actual CS50 offline missing-sign frequencies and live endpoint integration contract tests                                          | Live Exa-backed reference links require Exa configuration                                                    |
| D7   | 30-sentence diagnostic, coverage, paired context results, model comparison command and explicit `--check` gate                     | Diagnostic implementation complete; live quality results pending                                             |
| D8   | 14 inflection mappings observed in CS50 captions; availability-only mapping tests and measured handoff priorities                  | Caption-driven tuning complete; rendered signs/coverage need Hasan's dictionary                              |

## Independent findings and corrections

- The generated model schema contained `maxItems`, which Cerebras strict mode
  does not support. The sent schema now uses the portable model shape; local
  zod validation still enforces the 100-token and 200-character limits. Tests
  prohibit array/string length constraints in the model schema and verify
  oversized responses still retry and fall back.
- Phrase tokens such as `3.14 dogs` lost decimal punctuation. Number conversion
  now runs after splitting a phrase, including explicit FS-prefixed phrases.
- Typographic `don’t`/`can’t` missed negation normalization. Curly apostrophes
  are now normalized before contraction handling.
- Requested live mode could be confused with successful provider translation.
  Reports now expose `providerOnly`, label sentence runs with fallback, and
  fail explicit acceptance checks when successful live evidence is absent.
- The PR description referred to keeping a draft after the PR was made ready
  for review. The revised description records its actual state and outstanding
  acceptance inputs.
- Main now contains shared schemas and API/transcript services. The translator
  imports those shared contracts instead of maintaining duplicate types.
- Unit tests now isolate non-secret tier/batch/concurrency settings from local
  `.env` configuration. Reference requests follow the real API query contract;
  numeric FS entries are excluded from word searches, and unsupported queries
  are reported explicitly.

Live runs, exact model outputs, scoring corrections and timings are recorded
in [live-results.json](./live-results.json). Model/context vocabulary is an
evaluation fixture, not a claim that those signs have playable animations.

## Run the remaining acceptance checks

Use your personal development key in the ignored repo-root `.env`; no key belongs
in chat, committed files, report metadata or CI. Use the runtime animation
dictionary, rather than a fixture dictionary, for coverage targets.

```sh
# Offline diagnostics; never sponsor evidence.
pnpm eval:gloss
pnpm eval:gloss --corpus apps/api/src/gloss/fixtures/corpus.sample.json
mkdir -p apps/api/src/gloss/data
bun apps/api/src/gloss/cs50.ts > apps/api/src/gloss/data/cs50-corpus.json
pnpm eval:gloss --corpus apps/api/src/gloss/data/cs50-corpus.json

# Deliberately exits 1: fixture/offline evidence must not pass acceptance.
pnpm eval:gloss --corpus apps/api/src/gloss/fixtures/corpus.sample.json --check

# Actual developer-key runs after real captions and the API are available.
pnpm eval:gloss --live --compare
pnpm eval:gloss --live --check
pnpm --silent eval:gloss --corpus ./demo-corpus.json --live --api http://localhost:8787 --check > demo-report.json
```

`demo-corpus.json` has the same shape as the sample: a `source` of
`youtube-captions` or `manual`, and five distinct `videos`, each containing
`videoId`, timed `captions` and optional Exa `context`. The checked-in sample is
explicitly `fixture`; it is not a set of selected YouTube videos.

The corpus gate covers five-video coverage, timing, sign references and speed.
It requires at least 70% dictionary coverage in **each** nonempty output, valid
glosses, no overlaps/window or duration violations, reference links for every
missing word, successful live provider output without fallback, and at least
one video of three minutes or longer translated in under ten seconds. It does
not establish linguistic correctness or replace the real API/player run.

Sentence `--check` requires actual provider output, at least 70% coverage,
all expected glosses to match and positive context improvement when context
cases are included. Exact gloss matching is deliberately strict for
this gate; a fluent signer still needs to assess legitimate alternate ASL forms.
Plain reports remain diagnostic and exit zero; `--check` is the acceptance path.

## Blockers and ownership

- **PR rules:** the only failing rule is the missing `cross-team` label for
  the authorized root/API manifests. Adding it through `gh` returned HTTP 403.
  A maintainer must add the label; Raashed is already requested for review.
- **Sponsor runs:** a personal development key was supplied and used; it has a
  5-request/minute limit. Real Exa results still require Exa configuration.
- **Demo evidence:** all five selected CS50 videos/captions are fetched and
  measured. Only selected full-video/API runs, not all five live tracks, were
  executed; all five have offline coverage/frequency reports.
- **Coverage:** Hasan's real dictionary has zero signs; current coverage is 0%.
- **Quality/speed:** four of five context cases match exactly; crane remains
  unresolved. The 180-second excerpt took 2.9s, but the full 9:23 video took
  20.6s. A full three-minute-video speed claim is not established by either.
- **Integration:** shared schemas, transcript wiring and Exa endpoints are now
  on main and reused. No shared contracts or other owners' implementation files
  were edited by this integration.

## Optional stretch work

ISL grammar and additional non-manual face hints are not implemented. ISL is
rejected explicitly. Gloss strings are already returned on each sign for hosts
to display; a separate learner-mode UI belongs to the player/website tracks.
