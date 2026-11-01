# Durgesh: Sign Lingo (English → Sign Gloss + Timing)

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.2, §4.5

**Branch:** `durgesh/gloss`

## What you own

`apps/api/src/gloss/`: a **pure TypeScript module**. Its input is caption segments and its output is timed signs. It has no HTTP code; Raashed calls it from the API.

```ts
export function textToSigns(
  captions: { start: number; end: number; text: string }[],
  opts: { lang: SignLang; dictionary: string[] },
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
- **Batch** about 20 segments per call, keyed by segment index so results come back in the right order. Make the batch size a setting: on the Cerebras free trial (5 requests/min), use ~60 segments per call so a 3-min video needs only one call.
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
| [ ] D6b | Use `opts.context` (Exa) in the prompt; add 5 eval sentences where context changes the right sign (homonyms, names)                                                                                      | 11          |
| [ ] D6c | **Missing-signs report** `pnpm signs:missing`: the most-fingerspelled words in the demo videos, each with how-to-sign links from `/api/sign-reference` (Exa). Hasan uses it to pick what to animate next | 12          |
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
- D6b remains open: Live paired context runs corrected Java to COFFEE and MONA to MAUNA. After correcting the expected per-word FS boundary for Mauna Loa, 4/5 cases match exactly; the crane case remains a mismatch. The actual Exa fetch was not exercised.
- D6c/D7: Actual CS50 offline corpus/missing-sign reports are generated; Exa reference links still need Exa configuration. Numeric FS entries skip word-reference requests, unsupported query payloads remain explicit, and responses use shared SignReferenceSchema. The strict acceptance gates remain failed/blocked rather than claiming full completion.
- D8: Added 14 unambiguous inflection mappings observed in CS50 captions (including VARIABLES, VALUES, LOOPS and COMPARING), tested only against available dictionary keys. Hasan's measured top-200 handoff replaces the provisional word list; actual animation coverage remains 0%.
- Verification: 51 gloss/corpus/CS50 tests pass, alongside root lint, type check, test and build. The verifier independently rechecked shared integration and reference-query compatibility. Actual five-video dictionary coverage is unchanged from main (0% to 0%); live timings and outputs are in live-results.json. The full 9:23 Loops video took 20.6s, while the 180-second excerpt took 2.9s; the latter is not a full three-minute-video speed claim. The cross-team label has been applied; local PR rules use the actual PR metadata.

## Handoffs

- **Needs from Hasan:** `dictionary.json` (it grows during the event, so always read it at runtime).
- **Received from Raashed:** shared contracts, YouTube transcript fetcher and real API pipeline; used for the CS50 runs. Exa configuration is still needed for real reference links.
- **Gives Hasan:** measured top-200 CS50 vocabulary and missing-sign frequencies in the corpus report. Exa reference links remain pending configuration.
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
- [ ] With `context` set to `undefined`, output is still valid; with context, the homonym/name eval cases pass
- [x] Invalid JSON from Cerebras → one retry, then the rule-only fallback (test with a mocked client)
- [x] An HTTP 429 from Cerebras → backoff and retry (test with a mocked client)
- [x] Unit tests don't call the real Cerebras API (they use a mock), so CI never spends credits

## Definition of done

- [x] `textToSigns` passes all its unit tests; the timing never produces overlapping signs
- [ ] On the demo videos, **≥70% of the tokens are real signs** (not fingerspelled)
- [ ] A 3-minute video is glossed in **< 10s** on Cerebras
- [ ] Exa context improves at least the homonym/name eval cases
- [x] The eval script runs and its results are pasted in the README

## Demo role

During the pitch, explain in 30 seconds **why gloss is not word-for-word English**, using one before/after example on a slide.
