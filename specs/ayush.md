# Ayush: Demo and Pitch, Integration, Website Landing + Extension Pages

> Main plan: [../PLAN.md](../PLAN.md)

**Branch:** `ayush/web-pages`

You have three jobs:
1. **Product and demo owner:** choose the demo videos, write the story, run the pitch.
2. **Website pages:** build `/` (landing) and `/extension` inside Hasan's Next.js app, so Hasan can focus on the avatar.
3. **Integration owner:** from the halfway point, test everything end-to-end and track bugs.

---

## 1. Hours 0–3: Demo videos and story

- [ ] Choose the **5 demo videos** (1–3 min, clean **manual** English captions, simple everyday words: an educational explainer, a cooking clip, a news bite, a short kids' story, a product demo). Send the list to Raashed by **hour 3**
- [ ] Write the pitch story and the deck outline (see §4)
- [ ] Write the copy (text) for the landing page

## 2. Hours 2–14: Website pages (in `apps/web`)

Hasan sets up the app, shared layout and theme by hour 2. You build these pages on top, using shadcn/ui components. Hasan reviews your PRs.

| Route | Content | Target hour |
|---|---|---|
| `/` | Hero ("Every YouTube video, in sign language"), the problem, how it works (diagram from PLAN §2), a GIF of the extension, a demo video embed, buttons for "Try the demo" (→ `/watch`) and "Get the extension" (→ `/extension`), team section | 10 |
| `/extension` | Download button for the `.zip` (GitHub release), "load unpacked" steps with screenshots, a short FAQ (which videos work, privacy: we only send the video ID) | 12 |

- [ ] Use placeholder images until Poonam sends the GIF and screenshots (hour 17)
- [ ] Accessibility on your pages: semantic headings, alt text, keyboard navigation, contrast, `prefers-reduced-motion` for the GIF
- [ ] Open Graph image + meta tags so shared links look good
- [ ] If Hasan is behind at checkpoint 1, also take `/signs`

## 3. Hours 12–18: Integration owner

- [ ] Run the full flow (extension + `/watch`) on all 5 videos after each merge to `main`
- [ ] Keep a bug list as GitHub Issues: owner, steps to reproduce, severity (P0 = breaks the demo)
- [ ] Check the sync by eye: mark any sign that is more than 0.5s off, and send it to Durgesh (timing) or Poonam (sync)
- [ ] Note which words get fingerspelled the most in the demo videos and send them to Hasan and Durgesh

## 4. Hours 18–24: Demo and pitch

### Pitch deck (5–7 slides)
1. The problem: about 70 million Deaf people worldwide use more than 300 sign languages (World Federation of the Deaf; **check this before presenting**), and almost no online video has sign interpretation
2. Our solution: one-line description + a screenshot
3. Live demo (switch to the browser)
4. How it works: the pipeline diagram (Raashed)
5. Why it's hard: gloss ≠ English (Durgesh)
6. What's next: ISL, a bigger sign library, facial expressions, translations reviewed by the Deaf community
7. Team

### Demo script (about 3 minutes)

| Time | Who | What |
|---|---|---|
| 0:00 | Ayush | Hook + the problem |
| 0:30 | Poonam | Live extension: turn it on → avatar signs → pause / seek / 1.5× |
| 1:30 | Hasan | `/signs` page: avatar quality + fingerspelling a judge's name |
| 2:00 | Durgesh | Gloss slide: before/after example |
| 2:20 | Raashed | Architecture (20s) |
| 2:40 | Ayush | What's next + close |

### Backup plan
- [ ] Record a screen capture of the whole demo (hour 20) and keep it offline on the demo laptop
- [ ] Demo laptop: extension installed (from Poonam), local API + cache running (from Raashed), demo videos open in tabs, ads turned off (YouTube Premium or an ad-free account), notifications muted
- [ ] If the extension fails → use the website `/watch` page. If the network fails → play the recording
- [ ] Lead **2 full rehearsals** with a timer
- [ ] Prepare answers for likely judge questions: accuracy, how big the dictionary is, ASL vs ISL, involving the Deaf community, cost per video

## Handoffs
- **Gives Raashed:** the 5 demo videos (hour 3).
- **Needs from Hasan:** the scaffolded app + layout (hour 2); PR reviews.
- **Needs from Poonam:** the GIF and screenshots (hour 17); the `.zip` + an install on the demo laptop (hour 19).
- **Needs from Raashed:** the local API with the cache on the demo laptop (hour 20).
- **Needs from everyone:** their slide content by hour 19.

## Definition of done
- [ ] `/` and `/extension` are live and match the rest of the site
- [ ] Every demo video was tested end-to-end in the extension and on `/watch`
- [ ] Deck finished, backup recording made, 2 rehearsals done
