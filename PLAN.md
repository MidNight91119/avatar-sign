# SignStream: Sign Language Avatar Generator for YouTube

> Hackathon plan and spec · Website + browser extension · **TypeScript everywhere** · Built with sponsor tech: **Cerebras** (fast LLM inference) and **Exa** (web search for AI)

Each person has their own spec in [`specs/`](./specs):

| Track | Owner | Spec |
|---|---|---|
| Avatar and animation engine | **Hasan** | [specs/hasan.md](./specs/hasan.md) |
| Website: `/watch`, `/signs` (owns the app) | **Hasan** | [specs/hasan.md](./specs/hasan.md) |
| Sign lingo (English → sign gloss + timing) | **Durgesh** | [specs/durgesh.md](./specs/durgesh.md) |
| Browser extension | **Poonam** | [specs/poonam.md](./specs/poonam.md) |
| Backend: monorepo, shared contracts, transcript, API, cache, deploy | **Raashed** | [specs/raashed.md](./specs/raashed.md) |
| Demo and pitch, integration testing, website `/` and `/extension` pages | **Ayush** | [specs/ayush.md](./specs/ayush.md) |

> **Why Ayush builds two website pages:** Hasan has the two biggest tracks (avatar + website). Ayush builds the landing page and the `/extension` page inside Hasan's Next.js app, so Hasan can focus on the avatar, `/watch` and `/signs`. Hasan still owns the app and reviews the pages.

---

## 1. The problem and the idea

Most YouTube videos have no sign language interpretation. Captions help, but for many Deaf users sign language is their **first language**, and written English is a second language they may not read fluently.

**SignStream** adds an animated **sign language avatar** to any YouTube video. The avatar signs along with the speech, in sync with the video.

| Surface | What it does |
|---|---|
| **Browser extension** (Chrome, Manifest V3) | Adds a floating avatar panel to `youtube.com/watch` pages. The avatar signs in sync with the video, and pause, seek and playback speed are respected. |
| **Website** | Landing page, a live demo (paste a YouTube URL and watch it with the avatar), a **Discover** page to find videos by topic (Exa), an extension install page, and a page listing all supported signs. |

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

1. **Transcript:** get timed captions for the video from YouTube.
1b. **Context (Exa):** search the web for the video's title to learn its topic, the correct spelling of names, and the meaning of jargon. This helps the LLM pick the right sign (`BAT` the animal or `BAT` for baseball?) and fix names that auto-captions get wrong.
2. **Gloss (Cerebras):** sign languages have their own grammar. `"I am going to the store tomorrow"` becomes `TOMORROW STORE I GO`. Words with no sign become `FS:<word>` (fingerspelling).
3. **Sign track:** each sign gets a start time and duration inside its caption window. The track is cached per video.
4. **Avatar player:** given the sign track and the current video time, it plays the right animation.

**Target language:** ASL first (it has the most open data). The `lang` field leaves room to add ISL later.

### 2.1 Sponsor integrations (Cerebras + Exa)

Both sponsors are part of the core product, not add-ons. Judges should see them in the live demo.

| Sponsor | Where we use it | Why it matters | Owner |
|---|---|---|---|
| **Cerebras** | Gloss translation: English captions → sign gloss, the core LLM step | Very fast inference means a whole video is glossed in seconds, so a **new** video starts signing almost immediately instead of after a long wait. Show this live in the demo | Durgesh (module), Raashed (API wiring) |
| **Exa** | **1. Video context:** search the video's title → topic, names, jargon → added to the Cerebras prompt | Better sign choices and correctly spelled names | Raashed (fetch), Durgesh (prompt) |
| **Exa** | **2. Discover:** "find videos about photosynthesis" → Exa search limited to YouTube → open any result with the avatar | Turns the website from "paste a URL" into a way to find accessible content | Raashed (API), Ayush (`/discover` page) |
| **Exa** | **3. Sign references:** for words the avatar can't sign yet, find how-to-sign pages and videos (Handspeak, Lifeprint, SigningSavvy) | Speeds up making new animations (Hasan) and gives learners a "how to sign this" link | Durgesh (missing-signs report), Raashed (API), Hasan (`/signs` link) |

#### What the sponsors offer (from cerebras.ai, exa.ai and their docs, checked 2026-11-01)

**Cerebras**: https://www.cerebras.ai/ · docs: https://inference-docs.cerebras.ai/
- Inference Cloud with a **free trial**; the API is **OpenAI-compatible**, and the TypeScript SDK is `@cerebras/cerebras_cloud_sdk`
- Production models on shared inference:

  | Model ID | Speed (Cerebras docs) | Context (free / paid) | Our use |
  |---|---|---|---|
  | `gpt-oss-120b` | ~3,000 tokens/s | 65k / 131k | **Default** for gloss translation |
  | `qwen-3.8-27b` | ~1,850 tokens/s | 64k / 128k | Backup if quality or rate limits are a problem |

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

**What we get:** **$5 of Cerebras credit per person** (5 × $5 = **$25**) and **$100 of Exa credit**. Prices below are from exa.ai/pricing and inference-docs.cerebras.ai (checked 2026-11-01). The Cerebras per-token price isn't on its pricing page; the $0.35 / $0.75 per million tokens figure for `gpt-oss-120b` comes from price trackers.

| Call | What it costs | Cost per call |
|---|---|---|
| Cerebras gloss for a 3-min video (~2 calls, ~5k input + ~5k output tokens including reasoning) | $0.35/M input, $0.75/M output | **≈ $0.006** |
| Exa video context: `search` auto, 5 results + highlights | $7 per 1k searches + $1 per 1k pages | **≈ $0.012** |
| Exa `/discover`: 10 results + highlights | | ≈ $0.017 |
| Exa `/sign-reference`: 3 results + highlights | | ≈ $0.010 |
| Exa `answer` (stretch) | $5 per 1k | $0.005 |
| **One new video end to end** | | **≈ $0.02** |

**What the credits cover:** $25 of Cerebras is about **4,000 videos**, and $100 of Exa is about **5,000–8,000 calls**. Cost is not the constraint. **Rate limits are.**

**Cerebras rate limits (the real constraint):**

| Tier | `gpt-oss-120b` | `qwen-3.8-27b` |
|---|---|---|
| Free trial | **5 requests/min**, 30k uncached tokens/min, **1M tokens/day** | same |
| Developer (pay as you go) | 1,000 requests/min, 1M uncached tokens/min, no daily limit | 300 requests/min, 150k uncached tokens/min |

- Cerebras gives the $5 credit when you add a payment method, and it **expires 30 days after activation**. Activate it at kickoff, not before the event.
- Five requests a minute is too few for the deployed API: one new video plus a judge trying a second one would hit the limit. **The production API key must be on the Developer tier**, using Raashed's account. Raashed should check at kickoff that the account moved to the Developer tier after adding the card and credit.
- If the production key stays on the free trial, use larger batches (~60 segments per call, which fits a 3-min video in one call) and no parallel calls.

**Budget rules:**
1. **Separate keys:** one **production** Cerebras + Exa key, used only by the deployed API (Raashed). Each person uses **their own** $5 Cerebras key for local development. Store the Exa production key in the team password manager; for local work, use the Exa free tier ($10 a month per account) when possible.
2. **Cache everything:** sign tracks, video context, discover queries and sign references. A cached request never calls a sponsor API.
3. **Guard the public API:** per-IP rate limit, maximum video length 15 min, `/discover` limited to 30 searches per IP per hour.
4. **Run evals locally** on your own key, never against production.
5. **Check spend at every checkpoint** (hours 6, 12, 18) in both dashboards. If spend is above the plan, look for missing cache hits.
6. **Use the spare Exa credit well:** pre-fetch sign references for the 500 most common English words (~$5) so the `/signs` page loads instantly.

---

## 3. Tech stack (all TypeScript)

| Layer | Choice |
|---|---|
| Language | **TypeScript** (strict mode) in every package. No Python. |
| Monorepo | **Turborepo** + **pnpm** workspaces (`pnpm install`, `pnpm dev`, `pnpm test` from the root). Shared configs in `packages/typescript-config` and `packages/eslint-config`; ESLint + Prettier |
| Runtime | **Bun** inside individual packages: the API runs on Bun, and `api`, `shared`, `player` and the gloss module use `bun test`. The website (Next.js) and extension (Vite) use their own tools |
| Validation | `zod`: the shared schemas are the single source of truth for the JSON formats |
| Backend | **Hono** on **Bun** (`apps/api`) |
| Transcript | `youtubei.js` (or `youtube-transcript`) |
| LLM | **Cerebras** through `@cerebras/cerebras_cloud_sdk` (OpenAI-compatible, strict JSON schema output). Model: `gpt-oss-120b` (default) or `qwen-3.8-27b`, set with `CEREBRAS_MODEL` |
| Web search | **Exa** through `exa-js`: `search` with `type: "auto"`, `includeDomains`, `contents.highlights` and `outputSchema` |
| Cache | SQLite through Bun's built-in `bun:sqlite`, or Upstash Redis when deployed |
| Avatar | Three.js + `@pixiv/three-vrm` (VRM avatar); keyframe animation clips as JSON |
| Extension | Chrome MV3, Vite + `@crxjs/vite-plugin`, React for the popup |
| Website | Next.js (App Router) + Tailwind, deployed on Vercel |
| Tests | `bun test` for Bun packages; `pnpm test` runs every package's tests through Turborepo |

---

## 4. Shared contracts (agree on these in hour 0–1, then frozen)

These live in `packages/shared` as zod schemas plus TS types. **Changes need agreement from the whole team.**

### 4.1 Sign track (backend → player)

```ts
// packages/shared/src/sign-track.ts
export type SignLang = "ASL" | "ISL";

export interface Sign {
  gloss: string;        // "STORE", or "FS:BOB" for fingerspelling
  start: number;        // seconds in the video
  duration: number;     // seconds
  nonManual?: "question" | "negation" | "emphasis"; // stretch goal
}

export interface Segment {
  start: number;
  end: number;
  text: string;         // original caption text
  signs: Sign[];
}

export interface SignTrack {
  videoId: string;
  lang: SignLang;
  source: "youtube-captions" | "manual";
  status: "processing" | "ready" | "error";
  progress?: number;    // 0–1 while processing
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
    context?: VideoContext;   // from Exa, see below
  }
): Promise<Segment[]>;

// packages/shared/src/video-context.ts (Exa search with outputSchema returns this shape)
export interface VideoContext {
  topic: string;                               // "A lesson on how volcanoes form"
  names: string[];                             // correct spellings: ["Mauna Loa", "Kilauea"]
  terms: { term: string; meaning: string }[];  // [{ term: "magma", meaning: "molten rock under the ground" }]
}
```

### 4.3 API endpoints (Raashed)

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/sign-track?videoId=&lang=ASL` | `SignTrack` (starts processing if it isn't cached) |
| `GET` | `/api/signs?lang=ASL` | `string[]`: the glosses the avatar can play |
| `GET` | `/api/discover?q=` | `{ videoId, title, url, snippet, thumbnail }[]`: YouTube videos about a topic, found with **Exa** |
| `GET` | `/api/sign-reference?word=` | `{ title, url, source }[]`: how-to-sign pages for a word, found with **Exa** (cached) |
| `GET` | `/api/health` | `{ ok: true, cerebras: boolean, exa: boolean }` |

The client polls `/api/sign-track` every 2s while `status === "processing"`.

### 4.4 Avatar player (Hasan → Poonam and the website)

```ts
// packages/player/src/index.ts
export interface AvatarPlayer {
  load(track: SignTrack): void;
  tick(currentTimeSec: number): void;  // host calls this every animation frame
  setSpeed(rate: number): void;        // match video.playbackRate
  play(): void;
  pause(): void;
  playSign(gloss: string): void;       // used by the /signs page
  destroy(): void;
}

export function createAvatarPlayer(
  container: HTMLElement,
  opts?: { lang?: SignLang; assetsBaseUrl?: string; showGloss?: boolean }
): AvatarPlayer;
```

The player **never reads the YouTube video itself**. The host (the extension or the website) passes it the current time.

### 4.5 Sign dictionary (Hasan ↔ Durgesh)

`packages/sign-assets/dictionary.json`:

```json
{ "lang": "ASL", "signs": { "HELLO": "clips/hello.json", "STORE": "clips/store.json" }, "letters": { "A": "clips/fs-a.json" } }
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

## 6. Timeline (assumes 24 hours; scale to your event)

| Hour | Milestone |
|---|---|
| **0–1** | Kickoff. Raashed sets up the monorepo + `packages/shared` + the mock. **Everyone activates their $5 Cerebras credit and makes a dev key; Raashed sets up the production Cerebras (Developer tier) and Exa keys.** Everyone reads §4. |
| **1–6** | Everyone builds against the mock. |
| **6** | **Checkpoint 1 (15 min):** each person shows their piece working on its own. |
| **6–12** | Real data: live API, real clips, extension and website use the API. |
| **12** | **Checkpoint 2:** first end-to-end run. **Decide 3D avatar or 2D fallback.** |
| **12–18** | Sync polish, more signs, loading and error states, cache the demo videos. |
| **18** | **Feature freeze.** |
| **18–22** | Bug fixes, deck, backup recording, README. |
| **22–24** | Rehearse the demo at least twice. |

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

| Risk | Fallback | Who decides |
|---|---|---|
| The 3D avatar isn't ready by hour 12 | 2D skeleton mode in the player | Hasan |
| Hasan is overloaded (avatar + website) | Ayush already has `/` and `/extension`; Ayush also takes `/signs` if needed | Hasan + Ayush at checkpoint 1 |
| Small dictionary → too much fingerspelling | Synonym mapping; choose demo videos with simple words | Durgesh |
| YouTube captions are blocked or rate-limited | Pre-cache the demo videos; upload a manual `.vtt` | Raashed |
| The extension breaks during the demo | Demo on the website `/watch` page instead | Ayush |
| Cerebras rate limit (free trial: 5 requests/min, 1M tokens/day) or outage | Production key on the Developer tier; retry with backoff; switch to `qwen-3.8-27b`; fall back to rule-only gloss; demo videos are already cached | Durgesh + Raashed |
| A teammate's $5 Cerebras credit runs out | Unlikely (~800 videos each); that person borrows another teammate's dev key | Raashed |
| Exa quota or slow response | Cache every Exa result; context is optional, so glossing continues without it; pre-run the `/discover` queries used in the demo | Raashed |
| Venue Wi-Fi fails | Backup screen recording; run the API locally (Raashed sets it up on the demo laptop) | Ayush |

---

## 9. Working agreements

- **Branches:** always `<your-name>/<topic>`, for example `raashed/api`, `hasan/player`, `durgesh/gloss`, `poonam/extension`, `ayush/web-pages` → PR into `main`; one other person does a quick review (≤10 min)

### PR rules (checked automatically on every PR)

Every PR runs `.github/workflows/pr-checks.yml`. A PR can't be merged until it passes:

| Rule | What it means | How to fix it |
|---|---|---|
| **Tests pass** | `pnpm lint`, `pnpm check-types`, `pnpm test` and `pnpm build` pass, and you ran the **"PR test cases"** in your spec | Fix the failing tests; tick the test cases in the PR description |
| **Up to date with main** | Your branch contains the latest `main`, so you built against the current plan and specs | `git fetch origin && git rebase origin/main`, then re-read PLAN.md and your spec |
| **Your spec is updated** | If you changed code, you also updated `specs/<you>.md` (ticked finished tasks, noted changes) | Edit your spec, or add the `no-spec-change` label if it really isn't needed |
| **Your own work only** | The branch is `<you>/…`, you opened the PR, and you only changed files in your area (`.github/owners.json`). This applies to AI-made changes too | Ask the owner to make the change, or add the `cross-team` label and get their review |
| **No AI attribution** | No `Co-authored-by: Claude/Codex/...`, "Generated with ...", or 🤖 in commits or the PR | Reword the commits |

- Run the same check locally before you push: `node .github/scripts/pr-check.ts`
- AI coding agents get these rules from `AGENTS.md` (Codex, Cursor, others) and `CLAUDE.md` (Claude Code)
- Fill in `.github/pull_request_template.md`, including which AI tool you used
- Contracts in §4 are **frozen after hour 1** unless the whole team agrees
- **Never wait on someone:** use the mock and keep building
- **Update the team chat every 3 hours:** done / doing / blocked
- API keys (`CEREBRAS_API_KEY`, `EXA_API_KEY`) go in `.env` (never committed); `.env.example` lists the variable names. Get the sponsor credits or keys from the sponsor booths at kickoff
