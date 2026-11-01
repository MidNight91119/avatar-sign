# Demo segments (A-I1)

The one shared list of what we show on stage. The five videos are the CS50 regression corpus in [PLAN §10](../../PLAN.md#demo-corpus-and-latency-definitions) (`apps/api/src/gloss/cs50.ts`). This file only picks **excerpts** from them and does not replace them. Agreed with Raashed in [#21](https://github.com/rshdhere/avatar-sign/issues/21).

## Corpus (full videos)

Caption data comes from `apps/api/src/gloss/live-results.json` (2026-11-01). All five use manual English captions (`auto: false`).

| Video         | YouTube ID    | Full length | Caption cues |
| ------------- | ------------- | ----------- | ------------ |
| Data Types    | `Fc9htmvVZ9U` | 13:42       | 301          |
| Operators     | `f1xZf4iJDWE` | 12:21       | 244          |
| Loops         | `WgX8e_O7eG8` | 9:23        | 199          |
| Linear Search | `TwsgCHYmbbA` | 2:50        | 61           |
| Binary Search | `T98PIp4omUA` | 9:31        | 202          |

## Presentation segments (excerpts)

Each range covers whole caption sentences, from the start of the first quoted line to the end of the last one. The times come from the captions fetched by `apps/api/src/transcript.ts` on 2026-11-01. Exact cue times are in brackets.

| Use                 | Video         | Range                           | Length | First line                                      | Last line                                             |
| ------------------- | ------------- | ------------------------------- | ------ | ----------------------------------------------- | ----------------------------------------------------- |
| Live extension demo | Loops         | **6:42–8:01** (402.89–480.54 s) | 78s    | "So what are the use cases for a loop?"         | "…a great use case for prompting the user for input." |
| Backup segment      | Linear Search | **0:15–1:32** (15.03–91.72 s)   | 77s    | "The linear search algorithm works as follows." | "…hoping that we find the number 50."                 |
| Backup segment      | Binary Search | **2:03–3:15** (123.22–194.83 s) | 72s    | "Let's visualize this, OK?"                     | "…keep track of what's happening as we go."           |

**Why Loops for the live demo:** it has the highest share of everyday words of the three segments, and it uses a relatable example (a game loop that runs an unknown number of times). Share of the words in each range that are in the 500-word list in `apps/api/src/scripts/common-words.ts`:

- Loops: 33% of 321 words
- Linear Search: 26% of 255 words
- Binary Search: 23% of 261 words

Expect a lot of fingerspelling until Hasan's clip library grows.

## Stage video and speed benchmarks

PLAN §10 asks for one complete captioned video of about three minutes. None of the five corpus videos fits: Linear Search is 2:50 (170s), and the others are 9–14 minutes. So the benchmarks come from outside the corpus and add to it.

| Role                                                                                                     | Video                                                                                                 | Length                              | Scope                                                                          | Measured                                                                                                      |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Stage video**: opened live from `/discover` (the Cerebras moment) and the full-video **API** benchmark | [How Do Volcanoes Work? - Behind the News](https://www.youtube.com/watch?v=w1vhSSu8Nxw) `w1vhSSu8Nxw` | 3:53, 74 manual-caption cues        | complete video, **cold** API job on a throwaway cache (captions + Exa + gloss) | **9.9s** total, 5.0s gloss ([#21](https://github.com/rshdhere/avatar-sign/issues/21#issuecomment-6555897857)) |
| Full-video **gloss** benchmark                                                                           | [CS50 Defining Custom Types](https://youtu.be/96M4q0OnMfY) `96M4q0OnMfY`                              | 3:33 (213s), 69 manual-caption cues | complete video, captions + gloss, excludes Exa and avatar assets               | **3.91s** gloss, 4.84s captions + gloss (`apps/api/src/gloss/acceptance-results.json`)                        |

Why the volcano video for the stage:

- It's the only `/discover` candidate under 10s cold end to end. The other 3–4 min result with manual captions, "Binary search in 4 minutes" (`fDKIpRe8GW4`), took 14.1s.
- It uses everyday words (kids' news), and it fits the "find accessible videos" story.

Rules for the stage video:

- Raashed keeps it out of every cache warm and export, so it is **uncached** on stage.
- Run details: free Cerebras key (`CEREBRAS_TIER=free`), commit `d03fb20`, 0 fallback batches, 0 rate-limit errors (429s). The Exa context step hit its 4s cap and returned no context, so this run had none.
- All signs are fingerspelled until `dictionary.json` has clips (#20), and avatar asset loading is not included in these timings.

## `/discover` queries (pre-run by Raashed)

1. `how volcanoes work` (stage query; the volcano video is in its results)
2. `binary search explained`
3. `how computers store numbers`

`prerunDiscover` caches results for 1 hour (`apps/api/src/demo-cache.ts`), so the final pre-run has to happen within an hour of going on stage.

## Historical timings

Source: `apps/api/src/gloss/live-results.json`, model `gpt-oss-120b`, 0 fallback batches. These runs are from **before the timing-floor fix** (`apps/api/src/gloss/VERIFICATION.md`; PLAN §10 says they are not current acceptance evidence).

| What                                    | Scope                                          | Time  |
| --------------------------------------- | ---------------------------------------------- | ----- |
| Linear Search, API + YouTube + Cerebras | full video (170s, 61 cues), `youtube-captions` | 5.4s  |
| Data Types, API + Cerebras              | 180s excerpt, `manual` source                  | 2.9s  |
| Loops, API + YouTube + Cerebras         | full video (563s, 199 cues)                    | 20.6s |

Do not quote any of these as "a 3-minute video in N seconds": Linear Search is under 180s, Data Types is an excerpt, and Loops is a complete 9:23 video that missed the <10s target. Quote the two benchmarks above instead, with their scope.

## Still open

- [ ] Raashed confirms the list and warms the 5 corpus videos only, never the stage video (#21)
- [ ] Re-measure the stage video cold right before the pitch (same throwaway-cache method), once real clips exist
- [ ] Hasan and Durgesh confirm the three segments are readable once real clips exist (G1/G3)
