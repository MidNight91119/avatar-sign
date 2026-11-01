# Durgesh spec verification

Independent verification was requested for PR #10 on 2026-11-01. The complete
spec is **not yet satisfied**. This table distinguishes implemented behavior
from acceptance evidence that requires external inputs.

| Task | Implementation and automated evidence                                                                                                 | Remaining acceptance evidence                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1   | Grammar prompt, five examples, dictionary/context instructions and source links                                                       | Complete                                                                                                     |
| D2   | 200 everyday priorities; corpus ranking uses combined caption frequencies                                                             | Five selected demo transcripts and the resulting ranked handoff to Hasan                                     |
| D3   | Cerebras SDK, portable strict JSON schema, bounded local validation, batching/concurrency, retries/fallback and mocked sentence tests | Personal development key; live comparison of both models                                                     |
| D4   | Synonyms, FS fallback, numbers in phrase tokens, decimal/sign/percentage handling and straight/curly contraction tests                | Complete for the documented post-pass                                                                        |
| D5   | Weighted timing, filler removal, bounded gap overflow, centring and non-overlap tests, including overlapping long captions            | Dense captions can require sub-0.25s signs; corpus acceptance rejects these until content/pacing is reviewed |
| D6   | Stable `textToSigns` entry point and API handoff docs; corpus runner processes separate timed videos                                  | Raashed's real transcript/API wiring and end-to-end video run                                                |
| D6b  | Five context fixtures, prompt/data tests and paired with/without-context evaluation                                                   | Live semantic improvement on homonyms and names                                                              |
| D6c  | Caption/track report; corpus-wide missing words, frequency order and Exa endpoint links; local endpoint tests                         | Actual demo reports and live Exa-backed references                                                           |
| D7   | 30-sentence diagnostic, coverage, paired context results, model comparison command and explicit `--check` gate                        | Diagnostic implementation complete; live quality results pending                                             |
| D8   | General synonyms and corpus-based priorities/missing-word reports                                                                     | Tune against the selected five demo videos and animated dictionary                                           |

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

## Run the remaining acceptance checks

Use your personal development key in the ignored repo-root `.env`; no key belongs
in chat, committed files, report metadata or CI. Use the runtime animation
dictionary, rather than a fixture dictionary, for coverage targets.

```sh
# Offline diagnostics; never sponsor evidence.
pnpm eval:gloss
pnpm eval:gloss --corpus apps/api/src/gloss/fixtures/corpus.sample.json

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
- **Sponsor runs:** no development Cerebras key is available.
- **Demo evidence:** the five selected videos/captions have not been supplied.
- **Coverage:** Hasan's real dictionary has zero signs; current coverage is 0%.
- **Integration:** shared schemas, transcript wiring and the Exa endpoint are
  Raashed's work and have not landed on main. Local PLAN-compatible schemas
  remain a documented bridge; this PR does not alter shared contracts.

## Optional stretch work

ISL grammar and additional non-manual face hints are not implemented. ISL is
rejected explicitly. Gloss strings are already returned on each sign for hosts
to display; a separate learner-mode UI belongs to the player/website tracks.
