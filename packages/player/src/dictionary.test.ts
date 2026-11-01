import { expect, test } from "bun:test";
import dictionary from "../../sign-assets/dictionary.json";
import { knownSigns, naturalDuration, unitsFor, buildTimeline } from "./timeline";
import { HN } from "./engine/rig";
import { proceduralDictionary } from "./sync-dictionary";

test("dictionary registers only the actual procedural lexicon with canonical keys", () => {
  expect(proceduralDictionary()).toEqual(dictionary);
  const expected = knownSigns().map(sign => sign.replaceAll(" ", "-")).sort();
  expect(Object.keys(dictionary.signs).sort()).toEqual(expected);
  for (const [gloss, locator] of Object.entries(dictionary.signs)) {
    expect(gloss).toMatch(/^[A-Z][A-Z0-9_-]*$/);
    const units = unitsFor(gloss);
    expect(units).toHaveLength(1);
    const unit = units[0]!;
    expect("sign" in unit).toBe(true);
    if ("sign" in unit) expect(locator).toBe(`procedural:${unit.sign}`);
    expect(naturalDuration(gloss)).toBeGreaterThan(0);
  }
});

test("dictionary advertises A-Z and digit fallbacks that actually resolve", () => {
  expect(Object.keys(dictionary.letters).sort()).toEqual([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].sort());
  for (const [character, locator] of Object.entries(dictionary.letters)) {
    expect(locator).toBe(`procedural:FS:${character}`);
    expect(unitsFor(`FS:${character}`).length).toBeGreaterThan(0);
    expect(naturalDuration(`FS:${character}`)).toBeGreaterThan(0);
    const timeline = buildTimeline({segments:[{start:0,end:2,text:character,signs:[{gloss:`FS:${character}`,start:0,duration:1.2}]}]});
    expect(timeline.poseAt(0.5,new Array(2*HN).fill(0)).every(Number.isFinite)).toBe(true);
  }
});
