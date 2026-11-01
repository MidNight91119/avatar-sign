# Durgesh spec verification

Independent verification was requested for PR #10 on 2026-11-01. The complete
spec is **not yet satisfied**. This table distinguishes implemented behavior
from acceptance evidence that requires external inputs.

| Task | Implementation and automated evidence                                                                                           | Remaining acceptance evidence                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D1   | Grammar prompt, five examples, dictionary/context instructions and source links                                                 | Complete                                                                                                                      |
| D2   | 200 measured priorities from five official CS50 shorts / 1,007 actual caption segments                                          | Complete; word list and source links ready for Hasan                                                                          |
| D3   | SDK/schema/retry tests and live two-model comparison; both 7/10 exact matches, GPT 1.4s vs Qwen 7.1s                            | Comparison complete; GPT selected; remaining strict linguistic cases disclosed                                                |
| D4   | Synonyms, FS fallback, numbers in phrase tokens, decimal/sign/percentage handling and straight/curly contraction tests          | Complete for the documented post-pass                                                                                         |
| D5   | Weighted timing, filler removal, bounded gap overflow, centring and non-overlap tests, including overlapping long captions      | Floor enforced; dense captions trim trailing content (retaining NOT/FS:NOT where possible), pending linguistic simplification |
| D6   | Real YouTube/API/Cerebras runs: full Linear Search and Loops, plus a manual 180-second caption excerpt; shared track validation | Module/API integration complete; avatar playback still depends on Hasan                                                       |
| D6b  | Current live paired fixtures pass 5/5; Exa retrieval, topic/term categories, name and opposite-sense controls exercised         | General linguistic/visual review still required; evaluation vocabulary is not animation coverage                              |
| D6c  | Actual CS50 offline missing-sign frequencies and live endpoint integration contract tests                                       | Ten live allowlisted reference sets verified; remaining words intentionally unqueried to cap spend                            |
| D7   | 30-sentence diagnostic, coverage, paired context results, model comparison command and explicit `--check` gate                  | Diagnostic implementation complete; live quality results pending                                                              |
| D8   | 14 inflection mappings observed in CS50 captions; availability-only mapping tests and measured handoff priorities               | Caption-driven tuning complete; rendered signs/coverage need Hasan's dictionary                                               |

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

Historical live runs (before the timing-floor review fix), exact model outputs,
scoring corrections and timings are recorded
in [live-results.json](./live-results.json). Model/context vocabulary is an
evaluation fixture, not a claim that those signs have playable animations.

## PR review corrections

- Reproduced sub-minimum durations and missing outbound validation in regression
  tests. Timing now drops fillers, uses the actual bounded gap, then trims trailing
  content while retaining NOT/FS:NOT where possible. It never emits signs below 0.25s;
  a shorter window yields no signs. Dense content may be omitted until linguistic
  phrase simplification is available.
- The translator validates final output with the shared segment schema; a test
  injects zero-duration timing output and verifies rejection inside the module.
- Earlier review left D6b/D6c/speed open. The current acceptance section below
  supersedes those historical blockers; playable coverage and readability remain
  open. Original sponsor outputs remain unchanged for provenance.

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

- **PR rules:** the `cross-team` label is now applied for the authorized
  root/API manifests. Raashed has reviewed; review fixes remain subject to CI
  and re-review.
- **Sponsor runs:** a personal development key was supplied and used; it has a
  5-request/minute limit. A personal Exa key now verifies local context and references; production configuration still belongs to Raashed.
- **Demo evidence:** all five selected CS50 videos/captions are fetched and
  measured. Only selected full-video/API runs, not all five live tracks, were
  executed; all five have offline coverage/frequency reports.
- **Coverage:** Hasan's real dictionary has zero signs; current coverage is 0%.
- **Quality/speed:** current context fixtures match 5/5, and the full 3:33
  benchmark passed the speed-only gate (see below). Dense content loss and
  fingerspelling remain language/playback blockers. Earlier excerpt/Loops
  results remain historical and are not used for this speed claim.
- **Integration:** shared schemas, transcript wiring and Exa endpoints are now
  on main and reused. No shared contracts or other owners' implementation files
  were edited by this integration.

## Optional stretch work

ISL grammar and additional non-manual face hints are not implemented. ISL is
rejected explicitly. Gloss strings are already returned on each sign for hosts
to display; a separate learner-mode UI belongs to the player/website tracks.

## Current issue verification (2026-11-01)

The current [acceptance-results.json](./acceptance-results.json) records the
paired context test, actual Exa results, capped reference report, full benchmark
and real-dictionary coverage. No API keys, raw caption files or Exa page excerpts
are included. The full source video is [CS50 Defining Custom Types](https://cs50.harvard.edu/x/shorts/defining_custom_types/),
YouTube `96M4q0OnMfY`, 213 seconds; it supplements the original five-video corpus.

- **#15:** all five paired context fixtures pass with the unchanged expected
  glosses; three exact improvements, zero regressions and no fallback. Real Exa
  context reaches the same translator; named entities and machinery remain
  distinct from the bird interpretation. A rate-limited extra control is excluded
  from successful evidence and retried after quota reset.
- **#16:** the real local Hono service calls Exa for the reported top ten words;
  all ten have specific HTTP(S) references on the allowed sign sites. The report
  is explicitly truncated from 988 distinct missing words. Uppercase AND first
  yielded generic homepages; lowercase lookup returns specific sign pages.
  Numeric/unsupported entries remain explicit and unqueried.
- **#18:** the latest full-video run takes 3.91s for gloss and 4.84s for captions
  plus gloss, with two provider calls, 12,382 total / 9,608 completion tokens,
  and no fallback. Completion throughput includes provider reasoning tokens.
  The numerical timing gate passes, but 3 content tokens were omitted and 417 FS
  signs are flagged dense. This is a speed-only pass, not signability acceptance.
- **#17:** blocked: actual dictionary signs/letters are empty. Current per-video
  offline real-sign coverage is 0% for all five videos. Hasan's #20 is the dependency.
- **D-I2:** diagnostics now expose omissions and dense fingerspelling; corpus
  content/pacing acceptance stays false. Linguistic/readability review remains open.
- **D-I3:** three synthetic scheduling fixtures and forward/backward checkpoint
  tests are provided; animation visual review is not established by those fixtures.
- **D-I4:** 40-caption boundary integration is tested for both clean and overlapping
  raw cues after canonical normalization. Both YouTube and manual VTT ingress
  already normalize before batching, so the earlier synthetic bypass is not a
  demonstrated production defect. Account-wide quota/deployed coordination
  remains Raashed-owned; this branch changes none of his source.

Offline/unit checks never call sponsor services. Any gate not demonstrated above
remains unchecked in the owner spec; optional stretch work remains deferred.
