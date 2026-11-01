# Gloss module

Owner: **Durgesh** · Spec: [specs/durgesh.md](../../../../specs/durgesh.md)

English captions → timed sign gloss (Cerebras). Contract: PLAN §4.2.

## Use from the API

```ts
import { textToSigns } from "./gloss";

const segments = await textToSigns(captions, {
  lang: "ASL",
  dictionary: Object.keys(dictionary.signs),
  context, // optional Exa VideoContext
});
```

Raashed should load `packages/sign-assets/dictionary.json` for each job so new
clips are immediately usable. No dictionary or transcript is cached by this module.
Input captions need finite, nonnegative times, `end >= start`, and strictly
increasing start times. Overlapping windows are shortened to the next start.
Malformed input fails before any sponsor request. ISL throws an explicit unsupported
language error; this implementation provides ASL only.

Types and crossing-package validation use the published `@signstream/shared`
contracts. The local schemas add only gloss-specific ordering, language and
model-response validation. Raashed's transcript/API pipeline now calls this module.

## Installation

Run `pnpm install --frozen-lockfile` at the repository root. The API declares
the Cerebras SDK, zod and p-limit, and the workspace lockfile includes them.
The root scripts expose `pnpm eval:gloss` and `pnpm signs:missing`.

## Configuration

Keep keys in the API process environment or an ignored repo-root `.env` file for
the CLI commands. Run evals with your development key, never the production key.

| Variable               | Default            | Purpose                                       |
| ---------------------- | ------------------ | --------------------------------------------- |
| `CEREBRAS_API_KEY`     | absent             | No key means deterministic rule-only fallback |
| `CEREBRAS_MODEL`       | `gpt-oss-120b`     | Model used for translation                    |
| `CEREBRAS_TIER`        | developer behavior | Set `free` for sequential, 60-segment batches |
| `CEREBRAS_BATCH_SIZE`  | 20 (60 on free)    | Integer from 1 to 60                          |
| `CEREBRAS_CONCURRENCY` | 4                  | Integer from 1 to 4; free tier always uses 1  |

The SDK's automatic retries are disabled. Invalid output gets one retry; a 429
gets three retries after 1, 2 and 4 seconds. Other provider failures fall back
immediately. Each request has a 15-second timeout. Valid responses must contain
every requested index exactly once, including indices from later batches.
Sponsor outages and invalid responses affect only their batch.

Concurrency is per invocation. Raashed must limit account-wide traffic in the
API, cache completed tracks and serialize free-tier jobs as needed; this module
does not enforce an account's rolling requests-per-minute budget.

Structured `gloss.call` logs include elapsed time, reported token usage and
completion tokens per wall-clock second. `gloss.video` includes overall latency,
token totals and the number of fallback batches. Logs exclude caption text,
background context, keys and provider error bodies. These are measured client
latencies, not the provider's internal generation speed.

## Timing and fallback limits

Known signs are enforced after translation. Unknown words and names become
`FS:WORD`; common inflections and synonyms use an available dictionary key.
Numeric values use fingerspelling, with explicit MINUS/PLUS, POINT and PERCENT
tokens so a decimal is not silently changed into an integer.

Captions longer than 20 words are split into proportional contiguous windows.
Signs use the specified weights, 0.25–1.2 second durations and centred
idle time. If minimum durations do not fit, filler signs are removed first and
up to 0.5 seconds of a real following gap may be used. For irreducibly dense
captions, trailing tokens are removed while retaining NOT/FS:NOT where possible. This
can omit content and still needs linguistic review. Windows that cannot fit a
0.25-second sign emit no signs. Outbound segments are validated with the shared
schema before returning. ISL requests throw `UnsupportedSignLanguageError`.

Rule-only fallback drops simple English function words and keeps word order.
It preserves negation but does not perform context-based disambiguation or full
ASL grammar. Neither the prompt nor mocked tests establish linguistic accuracy;
a fluent ASL signer should review the live outputs and the actual animations.

## Evaluation and word priorities

See [VERIFICATION.md](./VERIFICATION.md) for the full task-by-task audit and
remaining acceptance evidence. The entire spec is not yet satisfied.

Run these commands from the repository root:

```sh
bun test apps/api/src/gloss/index.test.ts
pnpm eval:gloss
pnpm eval:gloss --live --compare
pnpm eval:gloss --live
pnpm eval:gloss --corpus apps/api/src/gloss/fixtures/corpus.sample.json
pnpm eval:gloss --corpus ./demo-corpus.json --live --api http://localhost:8787 --check
pnpm signs:missing --captions ./demo-captions.json
pnpm signs:missing --track ./sign-track.json --api http://localhost:8787
```

`--dictionary path.json` can select another dictionary. Every report reads the
file at runtime. The default is
Hasan's real dictionary, not a fabricated list of playable animations.

The evaluator has 30 sentences, including five context/name cases. Default mode
is offline and spends no credits even if a key exists. `--live` explicitly opts
into sponsor requests. `--live --compare` evaluates the first ten sentences on
both specified models. Ordinary sentences are batched; context cases use their
own background and are also evaluated without it to measure improvements and
regressions. Each report includes coverage, exact expected-gloss matches,
fallback counts, token usage and elapsed time. Exact matching is a diagnostic;
ASL permits more than one correct formulation.

`--corpus` accepts a `source` (`youtube-captions`, `manual` or `fixture`) and a
`videos` array of distinct video IDs with timed captions and optional context.
It reports per-video coverage, provider/fallback metrics, timing violations,
corpus-wide priorities and missing-sign reference links. `--check` exits 1 if
acceptance is failed or blocked. Offline, fixture and mocked runs cannot provide
live evidence; fallback output cannot satisfy the speed target. Shorter-than-
0.25s signs are explicitly flagged. Plain reports are diagnostics and exit zero.
Use `pnpm --silent ... > report.json` when saving machine-readable reports.

The missing-signs report accepts either an array of captions or a SignTrack
object. It ranks fingerspelled words by frequency, and also returns 200 word
priorities ranked by caption frequency with everyday words filling the list.
With `--api`, it requests `/api/sign-reference?word=...` once per distinct word
and includes the returned Exa-backed links. Failed lookups remain visible as
`unavailable`; without an API URL, links are marked `not-requested`.
Numeric fingerspelling is `not-applicable` for word-reference searches. Payloads
outside the API's 1–40 ASCII-letter query format are `unsupported-query` and
remain visible as acceptance blockers rather than producing avoidable HTTP 400s.
Offline caption mode is the default; `--live` opts into Cerebras translation.

[word-priorities.json](./word-priorities.json) gives Hasan 200 measured priorities
from 1,007 actual YouTube caption segments across five official CS50 shorts:
Data Types, Operators, Loops, Linear Search and Binary Search. The artifact
includes verified video/course URLs, durations, frequencies and attribution.

```sh
mkdir -p apps/api/src/gloss/data
bun apps/api/src/gloss/cs50.ts > apps/api/src/gloss/data/cs50-corpus.json
pnpm --silent eval:gloss --corpus apps/api/src/gloss/data/cs50-corpus.json > apps/api/src/gloss/data/cs50-report.json
```

The raw captions/reports stay in the ignored `data/` directory. `cs50.ts` uses
Raashed's actual YouTube fetcher and rejects videos over 15 minutes. CS50 content
is attributed under its [published license](https://cs50.harvard.edu/x/2026/license/).

## Verified results

- Root `pnpm lint`, `pnpm check-types`, `pnpm test` and `pnpm build`: passed
  with workspace dependencies installed from the lockfile.
- Gloss suite: 62 tests passed, including malformed JSON, indexed validation,
  429 backoff, free-tier batching, concurrency, context prompt forwarding,
  references and timing across dense/overlapping source windows, including
  overlapping long captions that are split before translation, portable model
  schemas, phrase numbers, Unicode contractions and corpus acceptance gates.
- Current offline eval on the real dictionary: 30 sentences, 0 playable dictionary
  entries, 0 real signs / 93 fingerspelled tokens, **0% coverage**, 10 exact
  matches, 0 context matches, 0 provider tokens. This is a scaffold baseline,
  not a quality or performance result for Cerebras.
- Main's rule-only placeholder and the current offline fallback were compared
  on the same five CS50 videos: **0% → 0%** dictionary coverage. This confirms
  no coverage regression with the empty dictionary, not the 70% product target.
- Ownership was checked directly: changes are in this folder,
  `specs/durgesh.md`, the two authorized
  package manifests and the shared lockfile. A PR needs the `cross-team` label
  and Raashed's review for the manifest changes.

Historical live evidence, collected before the timing-floor review fix, is recorded in [live-results.json](./live-results.json): both
models matched 7/10 expected glosses using evaluation-only vocabulary;
`gpt-oss-120b` took 1.4s versus 7.1s for `qwen-3.8-27b`, so the default stays
`gpt-oss-120b`. Context selected COFFEE for Java and corrected MONA to MAUNA.
With per-word name spelling scored correctly, 4/5 context cases match exactly;
the crane case was a mismatch in that historical run. The current 5/5 result is recorded below. Those historical runs used no fallback.

Through the real API, full Linear Search processed in 5.4s, a 180-second Data
Types caption excerpt in 2.9s, and full Loops (9:23) in 20.6s, all without
fallback. The excerpt is not a full three-minute YouTube video benchmark.
The supplied development key is limited to 5 requests/minute; paired context
runs were paced accordingly. Never treat quota waits or fallback as fast
provider evidence.

Still pending: Hasan's playable dictionary/animations (actual coverage is still 0%),
linguistic/readability review and full host/deployed integration. Current Exa and
full-video speed evidence is recorded below; all-30-case strict live quality is
not established by the five-case context run.

## Sources and prompt decisions

[Lifeprint's grammar overview](https://www.lifeprint.com/asl101/pages-layout/grammar.htm)
explains multiple valid sign orders, early time markers and omission of articles
and copulas. The prompt treats topic-comment as context dependent, rather than
forcing every sentence into one word order. The more specific demo examples
follow the project's spec.

[Cerebras structured outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs)
documents strict JSON schema support and its unsupported array constraints.
The portable model shape and bounded local validator share their object/index
definitions; local array/string length limits are omitted from the sent schema.
Every object has `additionalProperties: false`. SDK usage follows the
[official Node SDK](https://github.com/Cerebras/cerebras-cloud-sdk-node).

## Current acceptance work: issues #15–#18

See [acceptance-results.json](./acceptance-results.json) for current sanitized
measurements; the earlier `live-results.json` is retained as historical evidence.

| Item           | Current evidence                                                                                                                             | Limit                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| #15 context    | 5/5 paired fixture matches, three exact improvements, zero regressions/fallback; real Exa context and opposite-sense/name controls exercised | Vocabulary is evaluation-only; this does not claim playable assets or general linguistic accuracy               |
| #16 references | Top ten missing words from all five real caption sets have live Exa-backed, specific allowlisted references through the actual API           | Frequencies use offline fallback; 10 of 988 distinct words were queried, with explicit truncation               |
| #18 speed      | Full CS50 Defining Custom Types, 3:33 / 69 manual-caption cues: 3.91s gloss, 4.84s including caption fetch, two calls, no fallback           | Excludes Exa/avatar loading; three content tokens omitted and 417 FS signs flagged dense; speed-only acceptance |
| #17 coverage   | Actual dictionary still has zero entries; all five current offline reports have 0% real-sign coverage                                        | Blocked by Hasan's clips/dictionary (#20), not solved by fixture vocabulary                                     |

The prompt uses both topic and terms, does not invent specific time words from
past tense, preserves named entities and chooses available categories only when
context supports them. Provider requests use temperature 0 for repeatable
translation. `--context-only` evaluates the existing five cases and their
without-context controls; free-tier runs space translation invocations by 13s.
That pacing is not an account-wide limiter across processes/retries.

```sh
# Diagnostic, no sponsor calls; remains blocked on real acceptance.
pnpm eval:gloss --context-only

# Intentional live context run with an explicitly marked evaluation dictionary.
pnpm eval:gloss --context-only --live --dictionary ./evaluation-dictionary.json --check

# Full, untruncated YouTube captions + Cerebras benchmark. Defaults to runtime dictionary.
bun apps/api/src/gloss/benchmark.ts --video 96M4q0OnMfY --live --check

# Reference checks are independent of how the existing track was translated.
# Use a configured development API, not production credentials.
pnpm signs:missing --track ./sign-track.json --api http://localhost:8787 --limit 10 --check
```

`--limit` is 1–500 when supplied and caps returned words; each word makes at most two endpoint requests. Output
records `distinctMissingWords`, `reportLimit` and `reportTruncated`. Reference
`--check` requires actual HTTP endpoint results for the reported eligible words;
it cannot itself authenticate whether a custom endpoint is backed by Exa. This
branch's saved evidence uses Raashed's actual Hono/Exa services with a personal key.
Lowercase queries avoid upstream search-operator interpretation of AND; root homepages, membership/info/FAQ navigation, empty results and off-domain
URLs are not reported ready. A single clearer-phrase retry can recover a sign
entry without changing the reported word or inventing a URL. An API cache
holding older homepage results needs an owner-controlled refresh before retry.

Timing telemetry now reports dropped fillers/content and a fingerspelling-density
heuristic (less than 0.12 seconds per character). Counts contain no caption text or
names. Corpus acceptance checks these separately from numeric timing; a valid
schedule alone is not a fully interpreted track. Do not use omission to claim a
language-quality or coverage win.

The three [playback fixtures](./fixtures/playback.sample.json) are for Hasan/Poonam's
scheduler integration, with schema/seek-checkpoint tests. The owned pipeline test
covers valid non-overlapping input across the 40-caption split. Overlapping raw
cues are also tested through the canonical normalizer used by both real ingress
paths; no production boundary defect is claimed. Account-wide quota/deployed
coordination remains pending; see the verification file.
