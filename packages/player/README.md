# @signstream/player

Owner: **Hasan** · Spec: [specs/hasan.md](../../specs/hasan.md) · Contract: PLAN §4.4

The signing avatar. A procedural WebGL2 signer (sphere-traced hands, painted avatar) from Hasan's
**handAnimation** prototype, driven by a `SignTrack` and the video's clock. No model or clip files: every sign is
computed from a compact lexicon, so there is nothing to download besides the code.

```ts
import { createAvatarPlayer } from "@signstream/player";

const player = createAvatarPlayer(container, { showGloss: false });
player.load(track); // again with each partial snapshot; the clock is kept
requestAnimationFrame(function loop() {
  player.tick(video.currentTime); // media seconds, never multiplied by playback rate
  requestAnimationFrame(loop);
});
video.onpause = () => player.pause(); // hands hold still
video.onplay = () => player.play();
player.playSign("HELLO"); // /signs preview; the next tick() returns to the track
player.destroy(); // frees the WebGL context, observers and frame loop
```

In React, use `<AvatarCanvas>` from `@repo/ui/avatar-canvas` instead; it does all of the above.

## Files

| File                  | What it is                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`        | `createAvatarPlayer` (PLAN §4.4): springs, camera, uniforms, render loop, seek snapping, pause/preview, cleanup              |
| `src/timeline.ts`     | Typed and pure: `buildTimeline(track)` puts each sign's keyframes inside its own slot on media time; `poseAt(t)` eases between them |
| `src/engine/rig.ts`   | Prototype code kept **verbatim** (`@ts-nocheck`): hand rig, handshapes, ASL letters, 49 hand-tuned signs, the 684-line `LEX` notation and its compiler |
| `src/engine/shader.ts`| The WebGL2 fragment shader, verbatim                                                                                         |

The engine files are hand-tuned. Change them only with a visual check of the poses. The prototype's `CLAUDE.md`
(in the handAnimation project) explains the rig, the `LEX` grammar and the motion rules. Its main rules are no
bounce or wobble, near-critically damped springs, and orientation eased by quaternion slerp.

## How a track becomes motion

- Each `Sign` resolves to a lexicon sign, or else to fingerspelling (`unitsFor`). `FS:BOB` → B-O-B. Hyphenated
  glosses try the multi-word sign (`THANK-YOU` → `THANK YOU`), then each part. Unknown words are fingerspelled, never an error.
- The sign's keys are fitted inside `[start, start + duration)`: compressed if the slot is short, never stretched (the hand
  holds). The hand starts forming 0.12 s early. Gaps over 1.2 s go back to rest.
- `poseAt(t)` is pure (same t → same pose), so seeking just samples a new time. The player snaps the springs on a seek (any
  backward jump, or a forward jump over 0.6 s) instead of sweeping across.
- Pause fades out the idle sway and camera drift, so the hands hold still.

## Limits (next steps)

- ASL only. `lang` is accepted but ISL tracks are signed with ASL handshapes. Digits are preserved one at a time with existing ONE–NINE poses; zero explicitly fingerspells Z-E-R-O because no native zero pose exists. Mixed identifiers retain their letter/digit order. This is literal digit playback, not a new compound-number grammar.
- `assetsBaseUrl` is unused (no assets).
- Three avatars, `AVATARS` = Suki, Sara, Sasha. Pick one with `createAvatarPlayer(el, { avatar: 2 })`; the default is Sara. `avatar` is an optional addition to the PLAN §4.4 options, so hosts that don't pass it are unchanged.
- `packages/sign-assets/dictionary.json` now registers exactly the engine's native inventory. Keys are uppercase with spaces replaced by hyphens (`THANK-YOU`, `ICE-CREAM`, `I-LOVE-YOU`). Values are `procedural:<engine sign>` identifiers, not downloaded clip files; `letters` has A–Z and 0–9 `procedural:FS:<character>` identifiers.
- Regenerate after lexicon changes with `bun packages/player/src/sync-dictionary.ts` from the repo root. Tests check manifest equality and that every entry resolves to a finite playable pose. This makes no claim that every sign has been linguistically reviewed.

`bun test` covers the scheduling: three times, seeks, slot fitting, repeated glosses, unknown glosses and smiles.
