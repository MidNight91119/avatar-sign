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

The shared package currently exports only `SignLang`. `types.ts` and `schemas.ts`
temporarily describe PLAN §4 locally. Replace them with Raashed's shared exports
when those schemas land; the shared contracts have not been changed.

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
Signs use the specified weights, 0.25–1.2 second preferred durations and centred
idle time. If minimum durations do not fit, filler signs are removed first and
up to 0.5 seconds of a real following gap may be used. For irreducibly dense
captions, durations below 0.25 seconds preserve content without overlapping signs.
Those very fast signs need linguistic simplification before a polished demo.
Zero-length windows emit no signs.

Rule-only fallback drops simple English function words and keeps word order.
It preserves negation but does not perform context-based disambiguation or full
ASL grammar. Neither the prompt nor mocked tests establish linguistic accuracy;
a fluent ASL signer should review the live outputs and the actual animations.

## Evaluation and word priorities

Run these commands from the repository root:

```sh
bun test apps/api/src/gloss/index.test.ts
pnpm eval:gloss
pnpm eval:gloss --live --compare
pnpm eval:gloss --live
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

The missing-signs report accepts either an array of captions or a SignTrack
object. It ranks fingerspelled words by frequency, and also returns 200 word
priorities ranked by caption frequency with everyday words filling the list.
With `--api`, it requests `/api/sign-reference?word=...` once per distinct word
and includes the returned Exa-backed links. Failed lookups remain visible as
`unavailable`; without an API URL, links are marked `not-requested`.
Offline caption mode is the default; `--live` opts into Cerebras translation.

[word-priorities.json](./word-priorities.json) gives Hasan the initial 200 words.
It is explicitly provisional: the five demo videos and captions do not exist in
this checkout. Re-run the missing-signs report on those captions to replace the
everyday ordering with measured demo frequencies.

## Verified results

- Root `pnpm lint`, `pnpm check-types`, `pnpm test` and `pnpm build`: passed
  with workspace dependencies installed from the lockfile.
- Gloss suite: 31 tests passed, including malformed JSON, indexed validation,
  429 backoff, free-tier batching, concurrency, context prompt forwarding,
  references and timing across dense/overlapping source windows, including
  overlapping long captions that are split before translation.
- Offline eval on the real dictionary: 30 sentences, 0 playable dictionary
  entries, 0 real signs / 93 fingerspelled tokens, **0% coverage**, 10 exact
  matches, 0 context matches, 0 provider tokens. This is a scaffold baseline,
  not a quality or performance result for Cerebras.
- Main has no gloss implementation/evaluator, so an equivalent before/after
  evaluation is unavailable. The dictionary is empty on both branches.
- Ownership was checked directly: changes are in this folder,
  `specs/durgesh.md`, the two authorized
  package manifests and the shared lockfile. A PR needs the `cross-team` label
  and Raashed's review for the manifest changes.

Pending: live model comparison, actual Exa context
quality, five-video end-to-end validation, >=70% real-sign coverage and a timed
three-minute live video. No sponsor key or real demo captions were supplied.

## Sources and prompt decisions

[Lifeprint's grammar overview](https://www.lifeprint.com/asl101/pages-layout/grammar.htm)
explains multiple valid sign orders, early time markers and omission of articles
and copulas. The prompt treats topic-comment as context dependent, rather than
forcing every sentence into one word order. The more specific demo examples
follow the project's spec.

[Cerebras structured outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs)
documents strict JSON schema support. The schema is generated from the same zod
validator used to check responses, with `additionalProperties: false` on every
object. SDK usage follows the
[official Node SDK](https://github.com/Cerebras/cerebras-cloud-sdk-node).
