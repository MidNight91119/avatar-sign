# SignStream: Sign Language Avatar Generator for YouTube

> Hackathon plan and spec · Website + browser extension · **TypeScript everywhere** · Built with sponsor tech: **Cerebras** (fast LLM inference) and **Exa** (web search for AI)

Each person has their own spec in [`specs/`](./specs):

| Track                                                                   | Owner       | Spec                                   |
| ----------------------------------------------------------------------- | ----------- | -------------------------------------- |
| Avatar and animation engine                                             | **Hasan**   | [specs/hasan.md](./specs/hasan.md)     |
| Website: `/watch`, `/signs` (owns the app)                              | **Hasan**   | [specs/hasan.md](./specs/hasan.md)     |
| Sign lingo (English → sign gloss + timing)                              | **Durgesh** | [specs/durgesh.md](./specs/durgesh.md) |
| Browser extension                                                       | **Poonam**  | [specs/poonam.md](./specs/poonam.md)   |
| Backend: monorepo, shared contracts, transcript, API, cache, deploy     | **Raashed** | [specs/raashed.md](./specs/raashed.md) |
| Demo and pitch, integration testing, website `/` and `/extension` pages | **Ayush**   | [specs/ayush.md](./specs/ayush.md)     |

> **Why Ayush builds two website pages:** Hasan has the two biggest tracks (avatar + website). Ayush builds the landing page and the `/extension` page inside Hasan's Next.js app, so Hasan can focus on the avatar, `/watch` and `/signs`. Hasan still owns the app and reviews the pages.

> **Implementation refresh, 2026-11-01:** Read [§10](#10-implementation-baseline-and-next-gates) before starting another task. It records merged work, the remaining playback path, tool decisions and acceptance evidence. Existing checked tasks are retained; unpublished owner work must be reconciled before implementation.

---

## 1. The problem and the idea

Most YouTube videos have no sign language interpretation. Captions help, but for many Deaf users sign language is their **first language**, and written English is a second language they may not read fluently.

**SignStream** adds an animated **sign language avatar** alongside supported YouTube videos. MVP scope is English-captioned, non-live videos up to 15 minutes, with ASL output. The avatar follows the video timeline; missing captions use the documented manual fallback or a clear error.

| Surface                                     | What it does                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser extension** (Chrome, Manifest V3) | Adds a floating avatar panel to `youtube.com/watch` pages. The avatar signs in sync with the video, and pause, seek and playback speed are respected.                                               |
| **Website**                                 | Landing page, a live demo (paste a YouTube URL and watch it with the avatar), a **Discover** page to find videos by topic (Exa), an extension install page, and a page listing all supported signs. |

Both use the **same backend** and the **same avatar player package**.

---

## 2. How it works

```
YouTube videoId
      │
      ▼
┌──────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│ 1. Transcript    │──▶│ 2. Text → Sign Gloss │──▶│ 3. Timed Sign Track │
│ YouTube captions │   │ CEREBRAS LLM +       │   │ JSON, cached        │
│ (Raashed)        │   │ grammar rules        │   │ (Raashed)           │
└────────┬─────────┘   │ (Durgesh)            │   └──────────┬──────────┘
         │             └──────────▲───────────┘              │
         │  video title           │ context: names, topic,   │
         ▼                        │ jargon                   │
┌──────────────────┐              │                          │
│ 1b. EXA search   │──────────────┘                          │
│ video context    │                                         │
│ (Raashed)        │                                         │
└──────────────────┘                                         │
                                  ┌──────────────────────────┴───────────┐
                                  ▼                                      ▼
                       ┌────────────────────┐                ┌────────────────────┐
                       │ Extension overlay  │                │ Website /watch     │
                       │ (Poonam)           │                │ (Hasan)            │
                       └─────────┬──────────┘                └─────────┬──────────┘
                                 └──────────┬──────────────────────────┘
                                            ▼
                                 ┌──────────────────────┐
                                 │ 4. Avatar Player     │
                                 │ @signstream/player   │
                                 │ (Hasan)              │
                                 └──────────────────────┘
```

1. **Transcript:** fetch existing timed English captions from YouTube (manual first, then auto-generated). There is no audio extraction or speech-to-text stage in the MVP. Missing captions produce `NO_CAPTIONS`; an authenticated manual VTT upload is the existing fallback.
   1b. **Context (Exa):** search the web for the video's title to learn its topic, the correct spelling of names, and the meaning of jargon. This helps the LLM pick the right sign (`BAT` the animal or `BAT` for baseball?) and fix names that auto-captions get wrong.
2. **Gloss (Cerebras):** sign languages have their own grammar. `"I am going to the store tomorrow"` becomes `TOMORROW STORE I GO`. Words with no sign become `FS:<word>` (fingerspelling).
3. **Sign track:** each sign gets a start time and duration inside its caption window. The track is cached per video.
4. **Avatar player:** given the sign track and the current video time, it plays the right animation.

**Target language:** ASL first (it has the most open data). The `lang` field leaves room to add ISL later.

### 2.1 Sponsor integrations (Cerebras + Exa)

Both sponsors are part of the core product, not add-ons. Judges should see them in the live demo.

| Sponsor      | Where we use it                                                                                                                     | Why it matters                                                                                                                                                               | Owner                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Cerebras** | Gloss translation: English captions → sign gloss, the core LLM step                                                                 | Very fast inference means a whole video is glossed in seconds, so a **new** video starts signing almost immediately instead of after a long wait. Show this live in the demo | Durgesh (module), Raashed (API wiring)                               |
| **Exa**      | **1. Video context:** search the video's title → topic, names, jargon → added to the Cerebras prompt                                | Better sign choices and correctly spelled names                                                                                                                              | Raashed (fetch), Durgesh (prompt)                                    |
| **Exa**      | **2. Discover:** "find videos about photosynthesis" → Exa search limited to YouTube → open any result with the avatar               | Turns the website from "paste a URL" into a way to find accessible content                                                                                                   | Raashed (API), Ayush (`/discover` page)                              |
| **Exa**      | **3. Sign references:** for words the avatar can't sign yet, find how-to-sign pages and videos (Handspeak, Lifeprint, SigningSavvy) | Speeds up making new animations (Hasan) and gives learners a "how to sign this" link                                                                                         | Durgesh (missing-signs report), Raashed (API), Hasan (`/signs` link) |

#### What the sponsors offer (from cerebras.ai, exa.ai and their docs, checked 2026-11-01)

**Cerebras**: https://www.cerebras.ai/ · docs: https://inference-docs.cerebras.ai/

- Inference Cloud with a **free trial**; the API is **OpenAI-compatible**, and the TypeScript SDK is `@cerebras/cerebras_cloud_sdk`
- Production models on shared inference:

  | Model ID       | Speed (Cerebras docs) | Context (free / paid) | Our use                                        |
  | -------------- | --------------------- | --------------------- | ---------------------------------------------- |
  | `gpt-oss-120b` | ~3,000 tokens/s       | 65k / 131k            | **Default** for gloss translation              |
  | `qwen-3.8-27b` | ~1,850 tokens/s       | 64k / 128k            | Backup if quality or rate limits are a problem |

- **Structured outputs** with `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. Strict mode needs `additionalProperties: false` on every object in the schema
- Speed numbers are Cerebras's own claims. We measure our own end to end and use those in the pitch

**Exa**: https://exa.ai/ · docs: https://exa.ai/docs

- TypeScript SDK `exa-js`: `new Exa()` reads `EXA_API_KEY`
- **Search:** `exa.search(query, { type: "auto", numResults, includeDomains, contents: { highlights: true } })`. `type` can be `"auto"` (default, fast), `"deep-lite"` or `"deep"` (multi-step research, slower)
- **Highlights:** short, relevant excerpts of each page instead of the full text. Small enough to put straight into the Cerebras prompt
- **`outputSchema`:** search can return structured JSON that matches a schema, with citations. We use this for video context
- **Answer:** `exa.answer(question)` / `exa.streamAnswer(question)`: a direct answer with sources (stretch: "Ask about this video" on `/watch`)
- **Exa MCP server** (https://exa.ai/mcp): team members can connect it to their coding agents to search docs during the hackathon
- Keys and usage from https://dashboard.exa.ai

### 2.2 Sponsor credits and budget

**Budget assumptions:** Confirm credit eligibility, current pricing, expiry and account quotas in the sponsor dashboards before activation or spending. The following are kickoff estimates, not measured billing or guaranteed entitlements.

**What we planned:** **$5 of Cerebras credit per person** (5 × $5 = **$25**) and **$100 of Exa credit**. Prices below are from exa.ai/pricing and inference-docs.cerebras.ai (checked 2026-11-01). The Cerebras per-token price isn't on its pricing page; the $0.35 / $0.75 per million tokens figure for `gpt-oss-120b` comes from price trackers.

| Call                                                                                           | What it costs                        | Cost per call |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ | ------------- |
| Cerebras gloss for a 3-min video (~2 calls, ~5k input + ~5k output tokens including reasoning) | $0.35/M input, $0.75/M output        | **≈ $0.006**  |
| Exa video context: `search` auto, 5 results + highlights                                       | $7 per 1k searches + $1 per 1k pages | **≈ $0.012**  |
| Exa `/discover`: 10 results + highlights                                                       |                                      | ≈ $0.017      |
| Exa `/sign-reference`: 3 results + highlights                                                  |                                      | ≈ $0.010      |
| Exa `answer` (stretch)                                                                         | $5 per 1k                            | $0.005        |
| **One new video end to end**                                                                   |                                      | **≈ $0.02**   |

**What the credits cover:** $25 of Cerebras is about **4,000 videos**, and $100 of Exa is about **5,000–8,000 calls**. Cost is not the constraint. **Rate limits are.**

**Cerebras rate limits (the real constraint):**

| Tier                      | `gpt-oss-120b`                                                 | `qwen-3.8-27b`                             |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| Free trial                | **5 requests/min**, 30k uncached tokens/min, **1M tokens/day** | same                                       |
| Developer (pay as you go) | 1,000 requests/min, 1M uncached tokens/min, no daily limit     | 300 requests/min, 150k uncached tokens/min |

- Cerebras gives the $5 credit when you add a payment method, and it **expires 30 days after activation**. Activate it at kickoff, not before the event.
- Five requests a minute is too few for the deployed API: one new video plus a judge trying a second one would hit the limit. **The production API key must be on the Developer tier**, using Raashed's account. Raashed should check at kickoff that the account moved to the Developer tier after adding the card and credit.
- If the production key stays on the free trial, use larger batches (up to ~60 prepared segments per call), account-wide pacing and no parallel calls. One call is possible only if the prepared cue count fits and the API outer batch does not split it; runtime quota headers are authoritative (R-I3).

**Budget rules:**

1. **Separate keys:** one **production** Cerebras + Exa key, used only by the deployed API (Raashed). Each person uses **their own** $5 Cerebras key for local development. Store the Exa production key in the team password manager; for local work, use the Exa free tier ($10 a month per account) when possible.
2. **Cache everything:** sign tracks, video context, discover queries and sign references. A cached request never calls a sponsor API.
3. **Guard the public API:** per-IP rate limit, maximum video length 15 min, `/discover` limited to 30 searches per IP per hour.
4. **Run evals locally** on your own key, never against production.
5. **Check spend at every checkpoint** (hours 6, 12, 18) in both dashboards. If spend is above the plan, look for missing cache hits.
6. **Use the spare Exa credit well:** pre-fetch sign references for the 500 most common English words (~$5) so the `/signs` page loads instantly.

---

## 3. Tech stack (all TypeScript)

| Layer      | Choice                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language   | **TypeScript** (strict mode) in every package. No Python.                                                                                                                                   |
| Monorepo   | **Turborepo** + **pnpm** workspaces (`pnpm install`, `pnpm dev`, `pnpm test` from the root). Shared configs in `packages/typescript-config` and `packages/eslint-config`; ESLint + Prettier |
| Runtime    | **Bun** inside individual packages: the API runs on Bun, and `api`, `shared`, `player` and the gloss module use `bun test`. The website (Next.js) and extension (Vite) use their own tools  |
| Validation | `zod`: the shared schemas are the single source of truth for the JSON formats                                                                                                               |
| Backend    | **Hono** on **Bun** (`apps/api`)                                                                                                                                                            |
| Transcript | `youtubei.js` (or `youtube-transcript`)                                                                                                                                                     |
| LLM        | **Cerebras** through `@cerebras/cerebras_cloud_sdk` (OpenAI-compatible, strict JSON schema output). Model: `gpt-oss-120b` (default) or `qwen-3.8-27b`, set with `CEREBRAS_MODEL`            |
| Web search | **Exa** through `exa-js`: `search` with `type: "auto"`, `includeDomains`, `contents.highlights` and `outputSchema`                                                                          |
| Cache      | SQLite through Bun's built-in `bun:sqlite`, or Upstash Redis when deployed                                                                                                                  |
| Avatar     | Three.js + `@pixiv/three-vrm` (VRM avatar); keyframe animation clips as JSON                                                                                                                |
| Extension  | Chrome MV3, Vite + `@crxjs/vite-plugin`, React for the popup                                                                                                                                |
| Website    | Next.js (App Router) + Tailwind, deployed on Vercel                                                                                                                                         |
| Tests      | `bun test` for Bun packages; `pnpm test` runs every package's tests through Turborepo                                                                                                       |

---

## 4. Shared contracts (agree on these in hour 0–1, then frozen)

These live in `packages/shared/src/schemas.ts` and are exported from `@signstream/shared` as zod schemas plus inferred TS types. The file paths in the examples below are conceptual; import the package exports. **Changes need agreement from the whole team.** This planning refresh does not change the wire schemas or public player signatures.

### 4.1 Sign track (backend → player)

```ts
// packages/shared/src/sign-track.ts
export type SignLang = "ASL" | "ISL";

export interface Sign {
  gloss: string; // "STORE", or "FS:BOB" for fingerspelling
  start: number; // seconds in the video
  duration: number; // seconds
  nonManual?: "question" | "negation" | "emphasis"; // stretch goal
}

export interface Segment {
  start: number;
  end: number;
  text: string; // original caption text
  signs: Sign[];
}

export interface SignTrack {
  videoId: string;
  lang: SignLang;
  source: "youtube-captions" | "manual";
  status: "processing" | "ready" | "error";
  progress?: number; // 0–1 while processing
  error?: string;
  segments: Segment[];
}
```

A sample file lives at `mocks/sign-track.sample.json`. **Everyone builds against this mock until the real API works.**

### 4.2 Gloss module (Durgesh → Raashed)

```ts
// apps/api/src/gloss/index.ts
export function textToSigns(
  captions: { start: number; end: number; text: string }[],
  opts: {
    lang: SignLang;
    dictionary: string[];
    context?: VideoContext; // from Exa, see below
  },
): Promise<Segment[]>;

// packages/shared/src/video-context.ts (Exa search with outputSchema returns this shape)
export interface VideoContext {
  topic: string; // "A lesson on how volcanoes form"
  names: string[]; // correct spellings: ["Mauna Loa", "Kilauea"]
  terms: { term: string; meaning: string }[]; // [{ term: "magma", meaning: "molten rock under the ground" }]
}
```

### 4.3 API endpoints (Raashed)

| Method | Path                                | Returns                                                                                           |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/sign-track?videoId=&lang=ASL` | `SignTrack` (starts processing if it isn't cached)                                                |
| `GET`  | `/api/signs?lang=ASL`               | `string[]`: the glosses the avatar can play                                                       |
| `GET`  | `/api/discover?q=`                  | `{ videoId, title, url, snippet, thumbnail }[]`: YouTube videos about a topic, found with **Exa** |
| `GET`  | `/api/sign-reference?word=`         | `{ title, url, source }[]`: how-to-sign pages for a word, found with **Exa** (cached)             |
| `GET`  | `/api/health`                       | `{ ok: true, cerebras: boolean, exa: boolean }`                                                   |

The client polls `/api/sign-track` every 2s while `status === "processing"`. This is HTTP polling, not a streaming transport. The merged client also accepts `onPartial(track)` and `signal`; each partial track is a cumulative snapshot. Consumers replace the snapshot rather than concatenate it. `/api/health` reports whether keys are configured, not whether sponsor authentication succeeds.

### 4.4 Avatar player (Hasan → Poonam and the website)

```ts
// packages/player/src/index.ts
export interface AvatarPlayer {
  load(track: SignTrack): void;
  tick(currentTimeSec: number): void; // host calls this every animation frame
  setSpeed(rate: number): void; // match video.playbackRate
  play(): void;
  pause(): void;
  playSign(gloss: string): void; // used by the /signs page
  destroy(): void;
}

export function createAvatarPlayer(
  container: HTMLElement,
  opts?: { lang?: SignLang; assetsBaseUrl?: string; showGloss?: boolean },
): AvatarPlayer;
```

The player **never reads the YouTube video itself**. The host (the extension or the website) passes it the current time. `tick(t)` evaluates the absolute media timestamp; `setSpeed(rate)` must not multiply `t` again. Pause holds the sampled pose, and seeks evaluate the new timestamp without replaying intervening signs. See §11 for implementation semantics.

### 4.5 Sign dictionary (Hasan ↔ Durgesh)

`packages/sign-assets/dictionary.json`:

```json
{
  "lang": "ASL",
  "signs": { "HELLO": "clips/hello.json", "STORE": "clips/store.json" },
  "letters": { "A": "clips/fs-a.json" }
}
```

Hasan adds clips; Durgesh's prompt may only use the keys in `signs`. Everything else is fingerspelled.

---

## 5. Repo layout

```
avatar/
├── apps/
│   ├── api/              # Hono backend                       (Raashed)
│   │   └── src/gloss/    # English → gloss + timing           (Durgesh)
│   ├── extension/        # Chrome MV3 extension               (Poonam)
│   └── web/              # Next.js website                    (Hasan; Ayush: /, /extension, /discover)
├── packages/
│   ├── player/           # Avatar player, Three.js + VRM      (Hasan)
│   ├── sign-assets/      # Clips + dictionary.json            (Hasan, Durgesh picks the words)
│   └── shared/           # zod schemas, types, API client     (Raashed)
├── mocks/sign-track.sample.json                               (Raashed, hour 1)
├── specs/                # individual specs
└── PLAN.md
```

---

## 6. Original timeline (historical kickoff targets; use §10 gates for current work)

| Hour      | Milestone                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0–1**   | Kickoff. Raashed sets up the monorepo + `packages/shared` + the mock. **Everyone activates their $5 Cerebras credit and makes a dev key; Raashed sets up the production Cerebras (Developer tier) and Exa keys.** Everyone reads §4. |
| **1–6**   | Everyone builds against the mock.                                                                                                                                                                                                    |
| **6**     | **Checkpoint 1 (15 min):** each person shows their piece working on its own.                                                                                                                                                         |
| **6–12**  | Real data: live API, real clips, extension and website use the API.                                                                                                                                                                  |
| **12**    | **Checkpoint 2:** first end-to-end run. **Decide 3D avatar or 2D fallback.**                                                                                                                                                         |
| **12–18** | Sync polish, more signs, loading and error states, cache the demo videos.                                                                                                                                                            |
| **18**    | **Feature freeze.**                                                                                                                                                                                                                  |
| **18–22** | Bug fixes, deck, backup recording, README.                                                                                                                                                                                           |
| **22–24** | Rehearse the demo at least twice.                                                                                                                                                                                                    |

---

## 7. Definition of done (MVP)

- [ ] The extension shows a signing avatar on all 5 demo videos, within ~0.5s of the speech
- [ ] Pause, seek and speed changes keep the avatar in sync
- [ ] Words that aren't in the dictionary are fingerspelled
- [ ] The website is live with `/`, `/watch`, `/signs` and `/discover`
- [ ] **Cerebras** does all gloss translation; a new 3-minute video is ready in < 15s
- [ ] **Exa** is used for video context, the `/discover` page and sign references
- [ ] The API is deployed with caching; loading a cached video takes < 1s
- [ ] README + extension `.zip`

---

## 8. Risks and fallbacks

| Risk                                                                      | Fallback                                                                                                                                         | Who decides                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| The 3D avatar isn't ready by hour 12                                      | 2D skeleton mode in the player                                                                                                                   | Hasan                         |
| Hasan is overloaded (avatar + website)                                    | Ayush already has `/` and `/extension`; Ayush also takes `/signs` if needed                                                                      | Hasan + Ayush at checkpoint 1 |
| Small dictionary → too much fingerspelling                                | Synonym mapping; choose demo videos with simple words                                                                                            | Durgesh                       |
| YouTube captions are blocked or rate-limited                              | Pre-cache the demo videos; upload a manual `.vtt`                                                                                                | Raashed                       |
| The extension breaks during the demo                                      | Demo on the website `/watch` page instead                                                                                                        | Ayush                         |
| Cerebras rate limit (free trial: 5 requests/min, 1M tokens/day) or outage | Production key on the Developer tier; retry with backoff; switch to `qwen-3.8-27b`; fall back to rule-only gloss; demo videos are already cached | Durgesh + Raashed             |
| A teammate's $5 Cerebras credit runs out                                  | Unlikely (~800 videos each); that person borrows another teammate's dev key                                                                      | Raashed                       |
| Exa quota or slow response                                                | Cache every Exa result; context is optional, so glossing continues without it; pre-run the `/discover` queries used in the demo                  | Raashed                       |
| Venue Wi-Fi fails                                                         | Backup screen recording; run the API locally (Raashed sets it up on the demo laptop)                                                             | Ayush                         |

---

## 9. Working agreements

- **Branches:** always `<your-name>/<topic>`, for example `raashed/api`, `hasan/player`, `durgesh/gloss`, `poonam/extension`, `ayush/web-pages` → PR into `main`; one other person does a quick review (≤10 min)

### PR rules (checked automatically on every PR)

Every PR runs `.github/workflows/pr-rules.yml` and `.github/workflows/pr-quality.yml` as five separate checks: **PR rules**, **Lint**, **Type check**, **Tests** and **Build**. All five are required, so a PR can't be merged until they pass:

| Rule                     | What it means                                                                                                                                          | How to fix it                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Lint**                 | `pnpm lint` passes (ESLint, zero warnings)                                                                                                             | Fix the lint errors                                                                  |
| **Type check**           | `pnpm check-types` passes (strict TypeScript)                                                                                                          | Fix the type errors                                                                  |
| **Tests**                | `pnpm test` passes in every package                                                                                                                    | Fix the failing tests                                                                |
| **Build**                | `pnpm build` passes                                                                                                                                    | Fix the build                                                                        |
| **New test cases**       | If you changed source code in `apps/` or `packages/`, the PR also adds or updates `*.test.ts` files. You also ran the **"PR test cases"** in your spec | Write tests, or add the `no-tests-needed` label and explain why                      |
| **Up to date with main** | Your branch contains the latest `main`, so you built against the current plan and specs                                                                | `git fetch origin && git rebase origin/main`, then re-read PLAN.md and your spec     |
| **Your spec is updated** | If you changed code, you also updated `specs/<you>.md` (ticked finished tasks, noted changes)                                                          | Edit your spec, or add the `no-spec-change` label if it really isn't needed          |
| **Your own work only**   | The branch is `<you>/…`, you opened the PR, and you only changed files in your area (`.github/owners.json`). This applies to AI-made changes too       | Ask the owner to make the change, or add the `cross-team` label and get their review |
| **No AI attribution**    | No `Co-authored-by: Claude/Codex/...`, "Generated with ...", or 🤖 in commits or the PR                                                                | Reword the commits                                                                   |

- Run the same check locally before you push: `node .github/scripts/pr-check.ts`
- AI coding agents get these rules from `AGENTS.md` (Codex, Cursor, others) and `CLAUDE.md` (Claude Code)
- Fill in `.github/pull_request_template.md`, including which AI tool you used
- Contracts in §4 are **frozen after hour 1** unless the whole team agrees
- **Never wait on someone:** use the mock and keep building
- **Update the team chat every 3 hours:** done / doing / blocked
- API keys (`CEREBRAS_API_KEY`, `EXA_API_KEY`) go in `.env` (never committed); `.env.example` lists the variable names. Get the sponsor credits or keys from the sponsor booths at kickoff

## 10. Implementation baseline and next gates

### Evidence boundary (2026-11-01)

Baseline: upstream `main` at `c163c42` (merged PR #10). Inspected the source,
package manifests, merged PRs #2–#14 and the visible branches in the upstream
and Hasan/Ayush/Durgesh forks. No additional implementation branches were
published there at inspection time. This does not establish the state of anyone's
local checkout. Each owner must reconcile their latest branch before repeating work.

| Area    | Published evidence                                                                                                                                     | Next deliverable                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Raashed | Shared schemas/client/mock, transcript, Exa adapters, SQLite/jobs, routes, partial snapshots, demo CLI and Dockerfile are merged                       | Production configuration/deploy, provider quota coordination, boundary tests and final cache refresh |
| Durgesh | Gloss module merged in [PR #10](https://github.com/rshdhere/avatar-sign/pull/10); 51 gloss tests and historical live evidence in `apps/api/src/gloss/` | Context quality, dense-caption content review, real asset coverage and full-video speed acceptance   |
| Hasan   | `packages/player/src/index.ts` is a placeholder; dictionary has no signs/letters; website is a Next.js starter                                         | One renderable avatar, local clips and deterministic `tick(t)` player, then `/watch` and `/signs`    |
| Poonam  | `apps/extension/src/content.ts` is a placeholder; no MV3 manifest/build pipeline in main                                                               | Load-unpacked extension with one panel and a media-clock adapter, then API integration               |
| Ayush   | Landing route is the starter; no `/discover`, `/extension` or pitch artifacts published                                                                | Agree demo segments, build owned pages, and maintain evidence from both hosts                        |

A checked implementation task is not proof of deployed, browser-tested or
linguistically reviewed behavior. Preserve completed owner work and attach its
commit/test evidence; use new unchecked tasks below for remaining integration.

### Delivery order (gates replace elapsed-hour guesses)

| Gate                      | Owners and work that can proceed together                                                                                                                                                                           | Exit evidence                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| G1: mock playback         | Hasan: avatar + three verified clips + scheduler. Poonam: panel + mock track + clock adapter. Raashed: confirm existing client/error semantics. Durgesh: review mock pacing. Ayush: select short demo segments/copy | Same mock schedule selects the correct sign/pose after pause, backward/forward seek and 0.5×/2×; one clean mount/destroy cycle in both hosts |
| G2: real pipeline         | Poonam/Hasan connect existing API; Raashed deploys/configures; Durgesh checks whole-track boundaries and context                                                                                                    | Actual captions → actual provider → valid track → real clips in extension and `/watch`; fallback and mocked runs labelled separately         |
| G3: coverage and polish   | Hasan expands clips from measured priorities; Durgesh reruns per-video coverage; Raashed refreshes cached tracks; Ayush records bugs                                                                                | >=70% real-sign coverage per selected video, readable movements, no missing asset, no drift/duplicate panels after navigation                |
| G4: release and rehearsal | All owners run their spec cases; Poonam builds ZIP; Raashed exports cache; Ayush records/rehearses                                                                                                                  | Recorded five-video matrix, cold/warm timings, installable ZIP, working site/API links, local API cache and backup recording                 |

Do not block G1 on sponsor credentials or a 100-sign library. Do not mark G3/G4
complete from the mock alone. Optional ISL, more avatars, audio transcription,
automatic motion capture and Lottie UI work follow a working end-to-end path.

### Demo corpus and latency definitions

The selected **CS50 regression corpus** is already reproducible with
`bun apps/api/src/gloss/cs50.ts`; five official videos and 1,007 caption cues are
listed in `apps/api/src/gloss/word-priorities.json`. Keep these rather than silently
replacing the user's requested CS50 sources:

| Video         | YouTube ID    | Full length |
| ------------- | ------------- | ----------- |
| Data Types    | `Fc9htmvVZ9U` | 13:42       |
| Operators     | `f1xZf4iJDWE` | 12:21       |
| Loops         | `WgX8e_O7eG8` | 9:23        |
| Linear Search | `TwsgCHYmbbA` | 2:50        |
| Binary Search | `T98PIp4omUA` | 9:31        |

Ayush chooses clearly labelled short **presentation segments** from this corpus.
The original five mixed-topic 1–3-minute suggestion is superseded for corpus
selection. A segment demo does not replace testing the full videos. For the
speed gate, agree one complete captioned video around three minutes long;
Linear Search at 2:50 is useful but does not by itself satisfy the >=180-second
corpus gate. Adding a separate >=180-second benchmark does not replace the five.

Record separately: gloss-only target <10s (Durgesh), complete cold API job target
<15s (Raashed), cached API request <1s, and observed avatar sync within ~0.5s.
Include source duration/cue count, commit, dictionary revision, model/tier,
provider calls/fallbacks, and whether Exa/cache/asset loading is included. The
historical 180-second excerpt at 2.9s and 9:23 Loops at 20.6s are not current
full-three-minute acceptance proof. Never present cached/fallback timings as
live inference. Recheck billing and quotas rather than pitch the kickoff estimates.

## 11. Playback implementation guidance (existing contracts unchanged)

### Clock, schedule and motion

1. The backend returns `SignTrack` data, not rendered frames. The browser loads
   the avatar and reusable sign clips. No LLM, MediaPipe or sponsor call belongs
   in the animation frame loop.
2. Hasan flattens/indexes the signs on `load(track)`. At `tick(t)`, find the active
   interval `start <= t < start + duration`; render idle in real gaps. Derive
   progress `(t - start) / duration`, clamp to [0, 1], and sample the clip at
   `progress * clipDuration`. Support arbitrary backward/forward jumps and
   repeated instances of the same gloss. Do not use a chain of timers.
3. The extension passes `video.currentTime + offset`. `/watch` passes the
   YouTube IFrame player's `getCurrentTime() + offset`; it cannot inspect the
   cross-origin iframe's video DOM. Do not multiply media time by playback rate.
   `setSpeed` is compatible state for preview/ancillary motion; absolute sampling
   remains authoritative. `playSign` is a standalone preview; restore track pose
   on the next host-driven tick.
4. Blend transitions on the same media timeline, preserving sign handshapes and
   strokes. A short 0.1–0.15s blend is a starting point, bounded by clip/slot length
   and reviewed for legibility, not a requirement to blur every boundary. Seeks
   discard old blends. Pause/buffering freeze track-driven motion; decorations
   must not keep the signing hands moving.
5. Preload the avatar and first required clips, then nearby clips. `createAvatarPlayer`
   and `load` retain their synchronous signatures: initialize asynchronously
   inside the player, render a loading/idle state, and apply the latest track/time
   when assets resolve. A seek into an unloaded clip must not show a stale sign.
   Dispose fetches, actions, textures, listeners and frame loops on `destroy()`.
6. Finger spelling expands `FS:BOB` to B–O–B within **that sign's allocated slot**;
   it must not extend beyond it using a separate per-letter timer. Hasan and
   Durgesh must cover digits too (`FS:23`) and dynamic letters such as J/Z. A
   missing letter/digit needs a visible unsupported/loading state, never an
   invented handshape. Surface unreadably short sequences for linguistic review.
7. Partial tracks are cumulative snapshots of the same job. Replace the schedule,
   preserve the current media clock and sample again. Do not restart at zero or
   append duplicate segments. Past-ready data may play; ahead of prepared data,
   show idle/preparing rather than replay the last sign or stop YouTube forcibly.

### Extension lifecycle and website adapter

Poonam owns the content-script panel/clock. The service worker owns bounded API
requests with the configured API-origin host permission. It must not own a
permanent render loop or rely on in-memory state surviving suspension. Resume
polling from the content script through short worker requests, or implement and
test a reconnecting port; keep cached snapshots in `chrome.storage.session`.
Validate message payloads and a fixed API destination; do not accept arbitrary
fetch URLs from a page. No sponsor keys or `ADMIN_SECRET` belong in either host.

On a new video: cancel pending polling, discard stale responses by video/request
identity, destroy the previous player, remove listeners/observer and cancel rAF.
On ads: hide/freeze until the main media returns. On fullscreen: keep the panel
inside the fullscreen subtree. YouTube selectors and `yt-navigate-finish` are
site-specific heuristics, not guaranteed Chrome APIs; isolate and test them,
including URL changes and replacement video elements. Only one active panel and
clock loop may survive ten navigations. Re-sample on seek, visibility return and
media events even if playback is paused.

### Clip handoff (Hasan owns the format and files)

Define a small versioned JSON format in `packages/sign-assets` before bulk
production: target rig/conventions, finite duration, increasing keyframe times,
recognized humanoid/finger bones and normalized quaternion rotations. Validate
it in the loader and reject incompatible rigs. Test interpolation at the start,
middle and end; endpoints/loop behavior; left/right handedness; and every path
in `dictionary.json`. Keep the public dictionary shape from §4.5. Website and
extension consume it through the same player; neither implements another parser.
Document avatar/model/clip source and redistribution terms. Test packaged asset
URLs in the extension, where absolute website paths will not work.

## 12. Tool decisions and verification sources

Checked official documentation/repositories on 2026-11-01. These are capability
checks, not proof that dependencies have been installed or tested together.
Owners choose compatible pinned versions against the workspace Node/Bun/Vite
versions and commit only `pnpm-lock.yaml` changes when adding dependencies.

| Tool                          | Decision and responsible owner                                                                                                                                                          | Evidence                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three.js + `@pixiv/three-vrm` | Planned runtime for Hasan; not installed in the baseline player manifest. Use normalized humanoid bones and deterministic action sampling/blending                                      | [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html), [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html), [three-vrm](https://github.com/pixiv/three-vrm)                                                                                                            |
| Local JSON keyframe editor    | Start with a few verified signs on one rig; Hasan owns authoring, validation and asset provenance                                                                                       | Project §11 clip handoff; this editor is planned work, not an existing tool                                                                                                                                                                                                                              |
| MediaPipe                     | Optional authoring experiment for Hasan after G1; landmark detection still needs retargeting, calibration, cleanup and sign review. Keep it out of extension playback                   | [Holistic guide](https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker)                                                                                                                                                                                                      |
| Kalidokit                     | Upstream explicitly deprecated. Remove it as the required/default conversion step; do not add it without an isolated compatibility experiment and justification                         | [Upstream notice](https://github.com/yeemachine/kalidokit#readme)                                                                                                                                                                                                                                        |
| Lottie                        | Open-source authored-animation player, with frame seeking. Optional for UI or a separately authored 2D approach; not required for our skeletal player and not a sign generator          | [lottie-web API](https://github.com/airbnb/lottie-web#usage)                                                                                                                                                                                                                                             |
| Vite + `@crxjs/vite-plugin`   | Poonam adds the MV3 build and tests compatible versions. Bundle runtime JS/WASM locally; model/keyframe JSON are data, not executable remote code                                       | [CRXJS](https://github.com/crxjs/chrome-extension-tools), [Chrome MV3 code policy](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)                                                                                                                                      |
| Chrome content scripts/worker | Content script renders and reads the video; worker fetches with host permissions and tolerates suspension                                                                               | [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Network](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [Worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) |
| YouTube IFrame API            | Hasan's `/watch` uses documented time/state/rate methods, with cleanup, rather than cross-origin DOM access                                                                             | [Official reference](https://developers.google.com/youtube/iframe_api_reference)                                                                                                                                                                                                                         |
| Cerebras SDK                  | Already integrated; preserve portable strict JSON schema + stronger local zod bounds, validation retry and safe fallback. Model/account availability and quota are runtime observations | [Structured outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs)                                                                                                                                                                                                                 |
| Exa SDK                       | Already integrated; reuse context/discover/reference adapters, bounded requests, cache and undefined-context fallback. Live URLs/results require configured credentials                 | [Search reference](https://exa.ai/docs/reference/search)                                                                                                                                                                                                                                                 |
| Next.js/React, styling        | Existing web starter is Next 16/React 19; Tailwind/shadcn are choices in the old spec, not configured baseline dependencies. Hasan owns shared setup; Ayush reuses it                   | `apps/web/package.json`, `apps/web/app/layout.tsx`, `.github/owners.json`                                                                                                                                                                                                                                |
| pnpm/Bun/Turborepo/zod        | Reuse installed workspace tooling and shared exports; do not replace package managers or frozen schemas                                                                                 | Root manifests, `packages/shared/src/schemas.ts`, `AGENTS.md`                                                                                                                                                                                                                                            |

No new API key is needed to render a local avatar. Raashed needs production
Cerebras/Exa and hosting configuration; Durgesh uses a separate personal key
for opted-in evals. Keep secrets in ignored env/deployment configuration. Bun
loads env relative to the invoked working directory; confirm which ignored env
file each command reads without printing its contents. `CEREBRAS_TIER`, batch
size and concurrency currently belong to the gloss module's environment handling;
Raashed must document and coordinate them with his outer 40-caption pipeline.

## 13. Instructions for every owner's agent

1. Fetch/rebase, read this snapshot and your own spec, inspect your active owner
   branch/PR and preserve work newer than this baseline. Link the reconciled
   commit before claiming a task is done. Keep ownership boundaries; this
   cross-team documentation update does not authorize cross-team source edits.
2. Implement the first unchecked integration task in your spec that advances
   the next gate. Use the existing shared mock/client while another artifact is
   unavailable. Keep local test fixtures distinct from real animation coverage
   and sponsor evidence.
3. Each PR includes the task ID, changed paths, upstream/downstream handoff,
   test command/results, and remaining input. Add source tests and your own spec
   update. A root green build currently builds only the configured web app;
   Hasan/Poonam must add their owned test/build scripts as implementation lands.
4. Run root lint/types/test/build, owner PR cases and the PR checker. Browser,
   deployment, visual and live-provider cases that were not run stay unchecked
   with a reason. Never mark acceptance done from fixtures or a skeleton render.
5. Raashed reviews backend/shared/config changes, Hasan reviews player/assets
   and shared web setup, Poonam reviews extension adapters, Durgesh reviews gloss
   timing/linguistic evidence, Ayush reviews demo/copy/evidence. Contract changes
   need all affected owners; label cross-team plan/spec PRs appropriately.
6. Report handoffs through the PR: artifact path/commit, how to consume it, test
   evidence, blocker and receiving owner. Do not create duplicate APIs, clips,
   clocks or demo lists in another owner's directory to bypass a dependency.
