# Durgesh: Sign Lingo (English → Sign Gloss + Timing)

> Main plan: [../PLAN.md](../PLAN.md) · Contracts: PLAN §4.1, §4.2, §4.5

**Branch:** `durgesh/gloss`

## What you own
`apps/api/src/gloss/`: a **pure TypeScript module**. Its input is caption segments and its output is timed signs. It has no HTTP code; Raashed calls it from the API.

```ts
export function textToSigns(
  captions: { start: number; end: number; text: string }[],
  opts: { lang: SignLang; dictionary: string[] }
): Promise<Segment[]>;
```

You are the team's **sign language expert**. You also decide which words Hasan animates first.

---

## Background: why this isn't word-for-word

ASL has its own grammar. A few rules matter most:

| Rule | English | ASL gloss |
|---|---|---|
| Time words come first | I went to school yesterday | `YESTERDAY SCHOOL I GO` |
| Topic first, then the comment | I like that movie | `MOVIE THAT, I LIKE` |
| Drop articles and "to be" | The dog is big | `DOG BIG` |
| WH-question word at the end | What is your name? | `YOUR NAME WHAT` (+ question face) |
| Negation after the verb | I don't understand | `I UNDERSTAND NOT` |
| Names and unknown words are fingerspelled | My name is Bob | `MY NAME FS:BOB` |

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
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: batchJson }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "gloss_batch", strict: true, schema: glossBatchSchema },
    },
  });
  ```
  Strict mode needs `additionalProperties: false` on **every** object in the schema. On a validation failure, retry once, then fall back to a rule-only gloss (drop stopwords, keep word order).
- **Batch** about 20 segments per call, keyed by segment index so results come back in the right order.
- Put the **dictionary list in the system prompt** and tell the model to use only those words, or `FS:` for anything else.
- On a rate-limit error (HTTP 429), retry with exponential backoff (3 tries), then use the rule-only fallback for that batch.
- Use `p-limit` for concurrency (about 4 calls in parallel) so long videos finish fast.

### Step 4: Timing algorithm
- Weight of each sign: normal sign = 1.0; `FS:WORD` = 0.35 × number of letters; short signs (`I`, `YOU`, `MY`) = 0.6
- `duration_i = (segment length) × weight_i / sum(weights)`, clamped to a minimum of 0.25s and a maximum of 1.2s
- If the signs don't fit in the window even at the minimum duration: first drop filler signs (`I`, `MY`, `THAT`), then let the overflow run up to 0.5s into the gap before the next segment
- If the signs are much shorter than the window: centre them and leave the rest as idle time

---

## Tasks

| # | Task | Target hour |
|---|---|---|
| D1 | Research the grammar rules (table above); write the system prompt v1 | 1.5 |
| D2 | **Top-200 word list** ranked by how often the words appear in the captions of our 5 demo videos + common everyday words → give it to Hasan | **2** |
| D3 | `textToSigns()` with a Cerebras call + zod validation, tested with Vitest on 5 sentences; compare 2 Cerebras models | 5 |
| D4 | Post-pass: synonym map (`synonyms.ts`, for example `LARGE/HUGE → BIG`, `PURCHASE → BUY`), FS fallback, number handling | 7 |
| D5 | Timing algorithm + unit tests (signs never overlap; all signs stay inside their window ±0.5s) | 9 |
| D6 | Hand the module to Raashed and test it end-to-end on a real video | 10 |
| D6b | Use `opts.context` (Exa) in the prompt; add 5 eval sentences where context changes the right sign (homonyms, names) | 11 |
| D6c | **Missing-signs report** `pnpm signs:missing`: the most-fingerspelled words in the demo videos, each with how-to-sign links from `/api/sign-reference` (Exa). Hasan uses it to pick what to animate next | 12 |
| D7 | **Eval script** `pnpm eval:gloss`: 30 sentences with expected glosses + coverage report (% of tokens that are real signs rather than FS) | 13 |
| D8 | Tune using the demo videos: add synonyms and tell Hasan which missing signs would help most | 13–18 |

## Handoffs
- **Needs from Hasan:** `dictionary.json` (it grows during the event, so always read it at runtime).
- **Needs from Raashed:** real caption output from the demo videos (hour ~4) for testing.
- **Gives Hasan:** the ranked word list (hour 2), and later the missing-signs report with Exa reference links (hour 12) so Hasan knows what to animate next and has a video to copy from.
- **Gives Ayush:** Cerebras speed numbers (time per video, tokens/second) for the pitch (hour 16).
- **Gives Raashed:** the `textToSigns` module (hour 10).

## Stretch
- `nonManual` hints: questions → `"question"`, negation → `"negation"`
- ISL grammar (SOV order, different question rules) behind `lang: "ISL"`
- A "learner mode" that also returns the gloss text for display under the avatar

## Definition of done
- [ ] `textToSigns` passes all its unit tests; the timing never produces overlapping signs
- [ ] On the demo videos, **≥70% of the tokens are real signs** (not fingerspelled)
- [ ] A 3-minute video is glossed in **< 10s** on Cerebras
- [ ] Exa context improves at least the homonym/name eval cases
- [ ] The eval script runs and its results are pasted in the README

## Demo role
During the pitch, explain in 30 seconds **why gloss is not word-for-word English**, using one before/after example on a slide.
