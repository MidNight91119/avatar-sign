import type { Caption, Segment } from "./types";

const FILLERS = new Set(["I", "MY", "THAT"]);
const SHORT = new Set(["I", "YOU", "MY"]);
const MIN = 0.25;
const MAX = 1.2;

export function signWeight(gloss: string): number {
  return gloss.startsWith("FS:")
    ? 0.35 * Array.from(gloss.slice(3)).length
    : SHORT.has(gloss)
      ? 0.6
      : 1;
}

export function timeSigns(captions: Caption[], tokens: string[][]): Segment[] {
  return captions.map((caption, index) => {
    const next = captions[index + 1];
    const end = next ? Math.min(caption.end + 0.5, next.start) : caption.end;
    const available = Math.max(0, end - caption.start);
    const window = Math.max(0, Math.min(caption.end, end) - caption.start);
    let glosses = [...(tokens[index] ?? [])];
    while (glosses.length * MIN > window) {
      const filler = glosses.findIndex((gloss) => FILLERS.has(gloss));
      if (filler < 0) break;
      glosses.splice(filler, 1);
    }
    if (!window || !available || !glosses.length)
      return { ...caption, signs: [] };
    const weights = glosses.map(signWeight);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    let durations = weights.map((weight) =>
      Math.min(MAX, Math.max(MIN, (window * weight) / weightSum)),
    );
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    if (total > available) {
      if (glosses.length * MIN > available) {
        // shortcut: dense captions need sub-0.25s signs; upgrade to phrase simplification after linguistic review.
        durations = weights.map((weight) =>
          Math.min(MAX, (available * weight) / weightSum),
        );
      } else {
        const excess = total - glosses.length * MIN;
        durations = durations.map(
          (duration) =>
            MIN +
            ((duration - MIN) * (available - glosses.length * MIN)) / excess,
        );
      }
    }
    const used = durations.reduce((sum, duration) => sum + duration, 0);
    // Idle belongs inside the caption; overflow is only used when signs need it.
    let cursor = caption.start + Math.max(0, (window - used) / 2);
    const signs = glosses.map((gloss, i) => {
      const start = cursor;
      const duration = Math.max(0, Math.min(durations[i] ?? 0, end - start));
      cursor += duration;
      return { gloss, start, duration };
    });
    return { ...caption, signs };
  });
}
