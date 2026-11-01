import { describe, expect, test } from "bun:test";
import { SignTrackSchema } from "@signstream/shared";
import sample from "../../../mocks/sign-track.sample.json";
import { HN } from "./engine/rig";
import { buildTimeline, knownSigns, naturalDuration, unitsFor, type Pose } from "./timeline";

const track = SignTrackSchema.parse(sample);
const pose = (tl: ReturnType<typeof buildTimeline>, t: number): Pose => tl.poseAt(t, new Array(2 * HN).fill(0));

describe("unitsFor", () => {
  test("known words are signs, FS: and unknown words are fingerspelled", () => {
    expect(unitsFor("HELLO")).toEqual([{ sign: "HELLO" }]);
    expect(unitsFor("FS:BOB")).toEqual([{ spell: "BOB" }]);
    expect(unitsFor("XYZZY")).toEqual([{ spell: "XYZZY" }]);
  });

  test("hyphenated glosses use the multi-word sign, else each part", () => {
    expect(unitsFor("THANK-YOU")).toEqual([{ sign: "THANK YOU" }]);
    expect(unitsFor("EVERY-QZX")).toEqual([...unitsFor("EVERY"), { spell: "QZX" }]);
  });

  test("preserves digits and mixed identifiers without inventing a zero pose", () => {
    expect(unitsFor("FS:23")).toEqual([{ sign: "TWO" }, { sign: "THREE" }]);
    expect(unitsFor("FS:0")).toEqual([{ spell: "ZERO" }]);
    expect(unitsFor("FS:R2D2")).toEqual([{ spell: "R" }, { sign: "TWO" }, { spell: "D" }, { sign: "TWO" }]);
    expect(unitsFor("R2D2")).toEqual(unitsFor("FS:R2D2"));
    expect(unitsFor("FS:!!!")).toEqual([]);
  });
});

describe("buildTimeline", () => {
  const tl = buildTimeline(track);

  test("plays the right sign at three different times", () => {
    expect(tl.glossAt(0.1)).toBe("HELLO");
    expect(tl.glossAt(2.5)).toBe("FS:BOB");
    expect(tl.glossAt(9.2)).toBe("HOT");
  });

  test("same time → same pose, whatever was sampled before (seek safe)", () => {
    const a = pose(tl, 9.2);
    pose(tl, 40);
    pose(tl, 0);
    expect(pose(tl, 9.2)).toEqual(a);
  });

  test("different signs give different poses; rest before the first sign", () => {
    expect(pose(tl, 0.4)).not.toEqual(pose(tl, 9.3));
    const late = buildTimeline({ segments: [{ start: 5, end: 6, text: "", signs: [{ gloss: "HELLO", start: 5, duration: 0.6 }] }] });
    expect(pose(late, 0)).toEqual(pose(late, 3));
  });

  test("FS:BOB fits inside its slot instead of overrunning it", () => {
    const slot = buildTimeline({ segments: [{ start: 2, end: 3.05, text: "", signs: [{ gloss: "FS:BOB", start: 2, duration: 1.05 }] }] });
    // slot ends at 3.05; rest key at +0.3 blends ≤0.42 s (big wrist turn) → at rest by 3.8, same as long after
    expect(pose(slot, 3.8)).toEqual(pose(slot, 10));
    expect(pose(slot, 2.9)).not.toEqual(pose(slot, 10));
    expect(naturalDuration("FS:BOB")).toBeGreaterThan(0.8);
  });

  test("numeric fingerspelling occupies its slot with finite poses", () => {
    const number = buildTimeline({ segments: [{ start: 0, end: 2, text: "23", signs: [{ gloss: "FS:23", start: 0.2, duration: 1.2 }] }] });
    expect(number.glossAt(0.8)).toBe("FS:23");
    expect(naturalDuration("FS:23")).toBeGreaterThan(0);
    expect(pose(number, 0.8).every(Number.isFinite)).toBe(true);
    expect(pose(number, 0.8)).not.toEqual(pose(number, 5));
  });

  test("repeated glosses each play in their own slot", () => {
    const rep = buildTimeline({
      segments: [
        { start: 0, end: 8, text: "", signs: [{ gloss: "HOT", start: 1, duration: 0.6 }, { gloss: "HOT", start: 6, duration: 0.6 }] },
      ],
    });
    expect(rep.glossAt(1.2)).toBe("HOT");
    expect(rep.glossAt(6.2)).toBe("HOT");
    expect(pose(rep, 1.5)).toEqual(pose(rep, 6.5));
  });

  test("friendly signs make the avatar smile", () => {
    expect(tl.joyAt(0.4)).toBeGreaterThan(0);
    expect(tl.joyAt(9.3)).toBe(0);
  });

  test("an empty track is a resting avatar", () => {
    const empty = buildTimeline({ segments: [] });
    expect(empty.glossAt(1)).toBeUndefined();
    expect(pose(empty, 1).every(Number.isFinite)).toBe(true);
  });
});

test("knownSigns lists the lexicon", () => {
  const signs = knownSigns();
  expect(signs).toContain("HELLO");
  expect(signs).toContain("THANK YOU");
  expect(signs.length).toBeGreaterThan(500);
});
