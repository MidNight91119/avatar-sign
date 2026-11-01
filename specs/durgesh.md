# Durgesh: Sign Lingo (English → Sign Gloss + Timing)

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.2, §4.5

**Branch:** `durgesh/gloss`

> PR #10 is merged as of the PLAN §10 baseline. The implementation below is retained; the new D-I tasks track remaining acceptance and integration.

## What you own

`apps/api/src/gloss/`: a **pure TypeScript module**. Its input is caption segments and its output is timed signs. It has no HTTP code; Raashed calls it from the API.

```ts
export function textToSigns(
  captions: { start: number; end: number; text: string }[],
  opts: { lang: SignLang; dictionary: string[]; context?: VideoContext },
): Promise<Segment[]>;
```

You are the team's **sign language expert**. You also decide which words Hasan animates first.

---

## Background: why this isn't word-for-word

ASL has its own grammar. A few rules matter most:

| Rule                                      | English                    | ASL gloss                          |
| ----------------------------------------- | -------------------------- | ---------------------------------- |
| Time words come first                     | I went to school yesterday | `YESTERDAY SCHOOL I GO`            |
| Topic first, then the comment             | I like that movie          | `MOVIE THAT, I LIKE`               |
| Drop articles and "to be"                 | The dog is big             | `DOG BIG`                          |
| WH-question word at the end               | What is your name?         | `YOUR NAME WHAT` (+ question face) |
| Negation after the verb                   | I don't understand         | `I UNDERSTAND NOT`                 |
| Names and unknown words are fingerspelled | My name is Bob             | `MY NAME FS:BOB`                   |

Good sources: Lifeprint.com (Bill Vicars), "ASL gloss" guides. Spend at most 1 hour on research.

---

## Pipeline

```
caption segments
   │
   ├─▶ 1. Pre-clean: remove [Music], [Applause], speaker tags; fix auto-caption case; split long segments
   │
   ├─▶ 2. Cerebras LLM gloss (batched): segments + Exa context → gloss tokens, using only words from the dictionary
   │
   ├─▶ 3. Rule-based post-pass: uppercase; synonym map → dictionary keys; anything not in the dictionary → FS:WORD;
   │       numbers → FS digits; drop empty tokens
   │
   └─▶ 4. Timing: spread signs across [start, end] of each segment → Segment[]
```

### Step 2: LLM details (Cerebras, our sponsor)

- Use **Cerebras** through `@cerebras/cerebras_cloud_sdk` (the API is OpenAI-compatible). In the first hour, compare the two production models on your 10 test sentences and keep the better one in `CEREBRAS_MODEL`:
  - `gpt-oss-120b`: ~3,000 tokens/s, 65k context on the free tier. **Start with this one**
  - `qwen-3.8-27b`: ~1,850 tokens/s, 64k context. Use it if quality or rate limits are a problem
- **Use the speed:** Cerebras is fast enough to gloss a whole video in seconds. Log the time per video (tokens/second and total time). Ayush uses these numbers in the pitch.
- **Exa context:** `opts.context` is a `VideoContext` object (`topic`, `names`, `terms`; PLAN §4.2) that Raashed gets from Exa. Put it in the prompt as "Background about this video". Tell the model to use `terms` to pick the right sign for words with several meanings, and to use the spellings in `names` for fingerspelling (auto-captions often get names wrong). Glossing must still work when `context` is `undefined`.
- **Structured output:** use Cerebras strict structured outputs, then validate with `zod`:
  ```ts
  import Cerebras from "@cerebras/cerebras_cloud_sdk";
  const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

  const res = await client.chat.completions.create({
    model: process.env.CEREBRAS_MODEL ?? "gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: batchJson },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gloss_batch",
        strict: true,
        schema: glossBatchSchema,
      },
    },
  });
  ```
  Strict mode needs `additionalProperties: false` on **every** object in the schema. On a validation failure, retry once, then fall back to a rule-only gloss (drop stopwords, keep word order).
- **Batch** about 20 segments per call, keyed by segment index so results come back in the right order. Make the batch size a setting: on the Cerebras free trial (5 requests/min), use up to ~60 prepared segments per call and coordinate the API outer batch with Raashed. Duration alone does not guarantee one call; quota pacing must cover the whole account.
- **Budget:** your own $5 Cerebras key is for development and evals (about 800 videos' worth, so plenty). Never point evals at the production key. Log the token count per call so Raashed can track spend.
- Put the **dictionary list in the system prompt** and tell the model to use only those words, or `FS:` for anything else.
- On a rate-limit error (HTTP 429), retry with exponential backoff (3 tries), then use the rule-only fallback for that batch.
- Use `p-limit` for concurrency (about 4 calls in parallel on the Developer tier, 1 on the free trial) so long videos finish fast.

### Step 4: Timing algorithm

- Weight of each sign: normal sign = 1.0; `FS:WORD` = 0.35 × number of letters; short signs (`I`, `YOU`, `MY`) = 0.6
- `duration_i = (segment length) × weight_i / sum(weights)`, clamped to a minimum of 0.25s and a maximum of 1.2s
- If the signs don't fit in the window even at the minimum duration: first drop filler signs (`I`, `MY`, `THAT`), then let the overflow run up to 0.5s into the gap before the next segment
- If the signs are much shorter than the window: centre them and leave the rest as idle time

---

## Tasks

| #       | Task                                                                                                                                                                                                     | Target hour |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [x] D1  | Research the grammar rules (table above); write the system prompt v1                                                                                                                                     | 1.5         |
| [x] D2  | **Top-200 word list** ranked by how often the words appear in the captions of our 5 demo videos + common everyday words → give it to Hasan                                                               | **2**       |
| [x] D3  | `textToSigns()` with a Cerebras call + zod validation, tested with `bun test` on 5 sentences; compare 2 Cerebras models                                                                                  | 5           |
| [x] D4  | Post-pass: synonym map (`synonyms.ts`, for example `LARGE/HUGE → BIG`, `PURCHASE → BUY`), FS fallback, number handling                                                                                   | 7           |
| [x] D5  | Timing algorithm + unit tests (signs never overlap; all signs stay inside their window ±0.5s)                                                                                                            | 9           |
| [x] D6  | Hand the module to Raashed and test it end-to-end on a real video                                                                                                                                        | 10          |
| [x] D6b | Use `opts.context` (Exa) in the prompt; add 5 eval sentences where context changes the right sign (homonyms, names)                                                                                      | 11          |
| [x] D6c | **Missing-signs report** `pnpm signs:missing`: the most-fingerspelled words in the demo videos, each with how-to-sign links from `/api/sign-reference` (Exa). Hasan uses it to pick what to animate next | 12          |
| [x] D7  | **Eval script** `pnpm eval:gloss`: 30 sentences with expected glosses + coverage report (% of tokens that are real signs rather than FS)                                                                 | 13          |
| [x] D8  | Tune using the demo videos: add synonyms and tell Hasan which missing signs would help most                                                                                                              | 13–18       |

### Implementation status (2026-11-01)

**The entire spec is not yet complete.** Independent verification and the
remaining acceptance inputs are tracked in
[`apps/api/src/gloss/VERIFICATION.md`](../apps/api/src/gloss/VERIFICATION.md).

- D1: `prompt.ts` is based on Lifeprint and preserves multiple valid ASL sign orders rather than forcing OSV; sources are in the module README.
- D2: Selected five official CS50 shorts and fetched 1,007 actual YouTube caption segments. `word-priorities.json` now ranks 200 measured words with counts, video URLs and attribution; `cs50.ts` reproduces the corpus in ignored local data storage.
- D3: Live comparison completed with evaluation-only vocabulary: both models matched 7/10 expected glosses; GPT took 1.4s vs Qwen 7.1s, with no fallback. `gpt-oss-120b` remains selected. Shared published contracts now replace the temporary local copies.
- D4: Synonyms live alongside word normalization in `words.ts` to keep the small post-pass together. Decimal/sign/percentage information is preserved even inside phrase tokens, and Unicode contractions preserve negation. Both verifier-reported normalization defects have regression tests.
- D5: Enforce 0.25–1.2-second durations, remove fillers first, use at most 0.5 seconds of a real following gap, then trim trailing tokens while retaining NOT/FS:NOT where possible. Windows too short for one sign emit none; dense captions can lose content pending linguistic simplification. Outbound segments are parsed through the shared schema. Overlapping input windows are clipped to the next caption start before long captions are split at 20 words, so split windows remain ordered.
- D6: Main now includes the actual transcript/API pipeline. Real API + YouTube + Cerebras runs passed shared-schema/non-overlap assertions for full Linear Search and Loops, plus an authenticated manual 180-second Data Types excerpt. No other owner implementation files were changed.
- D6b: Issue #15 addressed with topic/term category guidance and deterministic decoding. All five paired context fixtures now match exactly, with three exact improvements and no regression/fallback. Separate real Exa context retrieval + Cerebras controls verify coffee, name spelling and bird interpretation; machinery/person-name controls prevent a global CRANE synonym. Evaluation vocabulary remains a fixture, not playable coverage.
- D6c/D7: Issue #16 addressed with ten live Exa-backed reference entries through the actual local API, using frequencies from all five real CS50 caption sets (offline rule-only token aggregation). The capped report is explicitly 10 of 988 distinct missing words; it is not an exhaustive live-gloss report. Lowercase lookup fixes the AND search, generic navigation/off-domain results are excluded, and numeric/unsupported queries remain explicit. `--limit` bounds requests; `--check` gates reported reference availability.
- D8: Added 14 unambiguous inflection mappings observed in CS50 captions (including VARIABLES, VALUES, LOOPS and COMPARING), tested only against available dictionary keys. Hasan's measured top-200 handoff replaces the provisional word list; actual animation coverage remains 0%.
- Verification: 63 gloss/corpus/CS50/benchmark/integration tests pass, alongside root lint, type check, test and build. The verifier independently rechecked shared integration and reference-query compatibility. Actual five-video dictionary coverage is unchanged from main (0% to 0%); live timings and outputs are in live-results.json. Earlier runs (Loops 20.6s, manual excerpt 2.9s) remain historical. Issue #18 is now verified on the full 3:33 Defining Custom Types video: 3.91s gloss, 4.84s including YouTube caption fetch, zero fallback. This is speed/numerical-timing evidence only; content/readability and animation coverage remain open. PR #10 is merged; this acceptance branch changes only Durgesh-owned files and his own spec.

## Handoffs

- **Needs from Hasan:** `dictionary.json` (it grows during the event, so always read it at runtime).
- **Received from Raashed:** shared contracts, YouTube transcript fetcher and real API pipeline; used for the CS50 runs. A personal Exa key now verifies local references; production deployment/configuration still belongs to Raashed.
- **Gives Hasan:** measured top-200 CS50 vocabulary and missing-sign frequencies in the corpus report. The measured top-ten live Exa references are in `acceptance-results.json`; the rest remain unqueried to bound development spend.
- **Gives Ayush:** Cerebras speed numbers (time per video, tokens/second) for the pitch (hour 16).
- **Gives Raashed:** the `textToSigns` module (hour 10).

## Stretch

- `nonManual` hints: questions → `"question"`, negation → `"negation"`
- ISL grammar (SOV order, different question rules) behind `lang: "ISL"`
- A "learner mode" that also returns the gloss text for display under the avatar

## PR test cases

Every PR must pass these before review (tick them in the PR description). Also see the PR rules in PLAN §9.

- [x] `pnpm eval:gloss` runs; coverage (real signs, not fingerspelling) did not drop compared with main; paste the before/after numbers in the PR
- [x] Every sign in the output is in `dictionary.json` or starts with `FS:`
- [x] Timing: no two signs overlap, and every sign stays inside its caption window ±0.5s (unit tests)
- [x] An empty caption, a `[Music]`-only caption and a 40-word caption all work without errors
- [x] With `context` set to `undefined`, output is still valid; with context, all five homonym/name eval fixtures pass (live paired evidence, fixture vocabulary)
- [x] Invalid JSON from Cerebras → one retry, then the rule-only fallback (test with a mocked client)
- [x] An HTTP 429 from Cerebras → backoff and retry (test with a mocked client)
- [x] Unit tests don't call the real Cerebras API (they use a mock), so CI never spends credits

## Definition of done

- [x] `textToSigns` passes all its unit tests; the timing never produces overlapping signs
- [ ] On the demo videos, **≥70% of the tokens are real signs** (not fingerspelled)
- [x] A full 3:33 video is glossed in **< 10s** on Cerebras (3.91s gloss / 4.84s captions+gloss; excludes Exa/assets and readability acceptance)
- [x] Real Exa context reaches Cerebras and improves coffee/name interpretation; five context fixtures pass. This is not general language-quality or playback acceptance.
- [x] The eval script runs and its results are pasted in the README

## Demo role

During the pitch, explain in 30 seconds **why gloss is not word-for-word English**, using one before/after example on a slide.

## Current integration work for your agent (D-I, 2026-11-01)

Read PLAN §§10–13. Keep the merged implementation and the passing timing/schema
regressions. Your output remains data; do not create the extension, player or
another owner's clip files in order to make coverage look complete.

| Task     | Implement / verify                                                                                                                                          | Evidence required                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [x] D-I1 | Resolve the crane context mismatch with a general context-sensitive prompt/post-pass approach, not an unconditional CRANE→BIRD synonym                      | Paired bird/construction-crane cases, undefined/wrong context controls, name cases and actual provider outputs; retain original/corrected scoring provenance                               |
| [ ] D-I2 | Review dense-caption trimming for content and readability with Hasan; report omitted content and overcompressed FS before calling a track fully interpreted | Examples including negation, names, numbers and short windows; keep 0.25–1.2s floor/cap and all fractional-boundary regressions; agree any semantic simplification with a competent signer |
| [x] D-I3 | Provide three short, reviewed mock sequences to test H-I3/P-I3, plus FS:BOB and FS:23 with clear boundary/gap expectations                                  | Shared mock consumed as-is when possible; additional owned gloss fixtures may test schedules but cannot redefine shared contracts or advertise missing assets                              |
| [ ] D-I4 | Coordinate R-I3/R-I4: outer batching, provider limits, next-caption boundary and whole-track validation                                                     | Real pipeline test across 40-caption boundary; no overlap in partial/final tracks; timings include queue waits and exclude fallback speed claims                                           |
| [ ] D-I5 | Re-run all five CS50 videos against Hasan's actual growing dictionary and send measured priorities/reference report                                         | Per-video >=70% gate stays open until met; dictionary revision and existing clips identified; no fixture vocabulary counted as playable coverage                                           |
| [x] D-I6 | Complete live Exa-backed missing-sign links after R-I2; keep numeric/unsupported queries explicit                                                           | Actual allowlisted URLs for missing words; successful endpoint contract tests alone do not close D6c                                                                                       |
| [ ] D-I7 | Agree a separate full >=180-second captioned benchmark with Ayush and measure gloss-only <10s using the current code, with actual provider/no fallback      | Full-video identity/duration/cue count, model/tier, quota waits, token usage and wall time; do not substitute the prior manual excerpt                                                     |
| [ ] D-I8 | Refresh live acceptance evidence after timing/prompt/dictionary changes; hand the validated revision to Raashed for cache refresh                           | 30-case diagnostics and strict gates reported honestly; D6b/D6c and DoD checkboxes only ticked with new passing evidence                                                                   |

Hasan needs the measured priorities now and later the readability review; Poonam
needs stable timestamps, not a new renderer from this module. No new credentials
are required for offline regressions. Use your personal key for intentional live
evals; account-wide quota behavior belongs to the API coordination with Raashed.
Keep historical pre-review live outputs labelled as historical.

### Additional PR test cases

- [x] Live controls distinguish bird, machinery and person-name uses without a global synonym; undefined-context paired runs remain valid.
- [x] Dense-caption loss and FS density are reported; the corpus content/pacing gate stays failed rather than claiming semantic correctness.
- [ ] Whole API-produced tracks remain non-overlapping across outer-batch and partial-snapshot boundaries.
- [ ] FS letters/digits and actual dictionary keys are playable by Hasan's renderer on both hosts before final coverage acceptance.

### Current issue and handoff evidence

- **#15 / D-I1:** paired context fixture gate passes 5/5. Actual Exa retrieval is separately exercised. One rate-limited control attempt was excluded and rerun after quota reset; fallback is never treated as provider evidence.
- **#16 / D-I6:** `pnpm signs:missing --track <aggregated-track.json> --api <development-api> --limit 10 --check` passed with ten specific allowlisted URL sets. Counts come from actual five-video captions with offline fallback, not an all-five live translation. Existing caches containing generic homepage results must be cleared by the API owner before retrying a corrected query.
- **#18 speed implementation / D-I7 coordination pending:** full official CS50 `96M4q0OnMfY` (213 seconds, 69 manual-caption cues), fetched without truncation. Latest run: two successful provider calls, 12,382 total tokens, 9,608 completion tokens (including reasoning), 3.91s gloss / 4.84s fetch+gloss, no fallback. This result also reports 3 omitted content tokens and 417 dense FS signs; playback/language acceptance remains open. Reproduction: `bun apps/api/src/gloss/benchmark.ts --video 96M4q0OnMfY --live --check`.
- **#17 / D-I5 remains blocked:** actual dictionary has zero signs and letters. All five current offline outputs remain 0% real-sign coverage; Hasan's asset work is tracked in #20. No dictionary keys or animations were invented to improve the score.
- **D-I2 remains open:** aggregate omission/FS-density diagnostics and a strict corpus heuristic gate are implemented; human linguistic/animation review remains necessary.
- **D-I3 implementation handoff:** three schema-valid synthetic schedules with FS:BOB, FS:23, gaps, negation and seek checkpoints are in `fixtures/playback.sample.json`. They are scheduling fixtures, not evidence of available/reviewed animation assets; visual review is still required.
- **D-I4 remains open:** an owned integration test verifies non-overlapping inputs through the real API pipeline across the 40-caption split. Tracing both real ingress paths confirms they call `normalizeCaptions` before batching. The integration test also covers overlapping raw cues after that canonical normalization. Bypassing normalization in a synthetic dependency can overlap, but no real-ingress defect is claimed. R-I3 account-wide quota and deployed coordination remain Raashed-owned and pending.
- **D-I8 remains open:** current sanitized acceptance evidence is provided, but full playable coverage, exhaustive references, linguistic sign-off and deployed cache/player integration are still pending.

### Immediate MVP readiness

- Latest integration rebased onto main `9462407` after PR #30. The actual API now advertises 733 procedural signs. A refreshed full Linear Search track has 346 tokens, 202 native signs (**58.38%**), zero provider fallback, 7.936s total with cached Exa context. The >=70% gate remains open.
- Computer-use verification on the real YouTube short confirmed extension hand-pose changes and caption/gloss progression from 01:17 to 01:35. Native signs and fingerspelling render; this is visual integration evidence, not linguistic sign-off. The merged extension needs `VITE_API_URL=http://localhost:8787` at build time and localhost host permission.
- Website integration now creates the privacy-enhanced iframe before attaching the YouTube clock API, avoiding the observed permanently blank auto-created frame. Actual CS50 playback, moving avatar and matching caption/gloss progression were observed at 02:13 in the app browser; the broader seek/rate matrix remains open.

- The fresh real API job for full Linear Search now completes in 8.658s including Exa/captions/gloss, zero fallback; actual localhost cached HTTP returns in 22.76ms. Private cache/export are prepared with existing commands, and a deterministic HTTP/client/partial/cache test is added.
- See `apps/api/src/gloss/MVP-HANDOFF.md` and `mvp-readiness.json` for startup/refresh instructions and the precise backup segment. No additional service or scalability work is introduced.
- Historical pre-bridge baseline: Hasan's player exposed 733 signs but had an empty dictionary and dropped digits. Its separate compatibility diagnostic reached 52.62% on Linear Search. Registration, digits and basic rendering are now fixed/verified above; #17 and linguistic acceptance remain open.

### Procedural vocabulary bridge (approved cross-owner scope)

The user approved the focused player/assets bridge. Canonical dictionary keys
are uppercase with hyphens for multi-word signs; `procedural:` values reference
actual engine definitions, not nonexistent clip files. The native inventory and
letter/digit fallback are validated in player tests. Coverage, cache refresh and
rendered readability must be measured before #17 can close; the earlier live
compatibility probe was 52.62%, below target.
