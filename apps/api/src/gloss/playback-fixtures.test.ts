import { expect, it } from "bun:test";
import { SignTrackSchema } from "@signstream/shared";
import fixtures from "./fixtures/playback.sample.json";

it("provides three schema-valid playback fixtures with names, digits, gaps and seek checkpoints", () => {
  expect(fixtures.tracks).toHaveLength(3);
  const glosses = [];
  for (const { track: input, checkpoints } of fixtures.tracks) {
    const track = SignTrackSchema.parse(input);
    const signs = track.segments.flatMap((s) => s.signs);
    let end = 0;
    for (const sign of signs) {
      expect(sign.start + 1e-8).toBeGreaterThanOrEqual(end);
      expect(sign.duration).toBeGreaterThanOrEqual(0.25);
      expect(sign.duration).toBeLessThanOrEqual(1.2);
      end = sign.start + sign.duration;
      glosses.push(sign.gloss);
    }
    for (const point of [...checkpoints, ...[...checkpoints].reverse()]) {
      const active = signs.find(
        (sign) =>
          point.time >= sign.start && point.time < sign.start + sign.duration,
      );
      expect(active?.gloss ?? null).toBe(point.gloss);
    }
  }
  expect(glosses).toContain("FS:BOB");
  expect(glosses).toContain("FS:23");
  expect(glosses).toContain("NOT");
});
