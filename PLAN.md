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

---

## 3. Tech stack (all TypeScript)

| Layer | Choice |
|---|---|
| Language | **TypeScript** (strict mode) in every package. No Python. |
| Monorepo | `pnpm` workspaces, shared `tsconfig.base.json`, Biome (or ESLint + Prettier) |
| Validation | `zod`: the shared schemas are the single source of truth for the JSON formats |
| Backend | Node.js 20+ with **Hono** |
| Transcript | `youtubei.js` (or `youtube-transcript`) |
| LLM | **Cerebras** through `@cerebras/cerebras_cloud_sdk` (OpenAI-compatible API, structured JSON output). Choose the model from the Cerebras model list on the day: a large model such as `gpt-oss-120b` or `llama-3.3-70b` |
| Web search | **Exa** through `exa-js` (`searchAndContents`, filtered by domain) |
| Cache | SQLite through `better-sqlite3` locally, or Upstash Redis when deployed |
| Avatar | Three.js + `@pixiv/three-vrm` (VRM avatar); keyframe animation clips as JSON |
| Extension | Chrome MV3, Vite + `@crxjs/vite-plugin`, React for the popup |
| Website | Next.js (App Router) + Tailwind, deployed on Vercel |
| Tests | Vitest |

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
    context?: string;   // from Exa: video topic, names, jargon (≤ 1,500 characters)
  }
): Promise<Segment[]>;
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
| **0–1** | Kickoff. Raashed sets up the monorepo + `packages/shared` + the mock. Everyone reads §4. |
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
| Cerebras rate limit or outage | Retry with backoff; fall back to rule-only gloss; demo videos are already cached | Durgesh |
| Exa quota or slow response | Cache every Exa result; context is optional, so glossing continues without it; pre-run the `/discover` queries used in the demo | Raashed |
| Venue Wi-Fi fails | Backup screen recording; run the API locally (Raashed sets it up on the demo laptop) | Ayush |

---

## 9. Working agreements

- **Branches:** `raashed/api`, `hasan/player`, `hasan/web`, `durgesh/gloss`, `poonam/extension`, `ayush/web-pages` → PR into `main`; one other person does a quick review (≤10 min)
- Contracts in §4 are **frozen after hour 1** unless the whole team agrees
- **Never wait on someone:** use the mock and keep building
- **Update the team chat every 3 hours:** done / doing / blocked
- API keys (`CEREBRAS_API_KEY`, `EXA_API_KEY`) go in `.env` (never committed); `.env.example` lists the variable names. Get the sponsor credits or keys from the sponsor booths at kickoff
