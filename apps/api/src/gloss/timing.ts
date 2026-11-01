import type { Caption, Segment } from "./types";

const FILLERS = new Set(["I", "MY", "THAT", "FS:I", "FS:MY", "FS:THAT"]);
const NEGATIONS = new Set(["NOT", "FS:NOT"]);
const SHORT = new Set(["I", "YOU", "MY"]);
const MIN = 0.25;
const MAX = 1.2;
// Decimal caption timestamps accumulate tiny errors when sign durations are added.
const EPSILON = 1e-8;

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
    const windowEnd = Math.min(caption.end, end);
    const window = Math.max(0, windowEnd - caption.start);
    const glosses = [...(tokens[index] ?? [])];
    while (caption.start + glosses.length * MIN > windowEnd + EPSILON) {
      const filler = glosses.findIndex((gloss) => FILLERS.has(gloss));
      if (filler < 0) break;
      glosses.splice(filler, 1);
    }
    // shortcut: trim trailing content, preserving NOT; use linguistic phrase simplification when available.
    while (caption.start + glosses.length * MIN > end + EPSILON) {
      let trailing = glosses.length - 1;
      while (trailing >= 0 && NEGATIONS.has(glosses[trailing] ?? ""))
        trailing--;
      glosses.splice(trailing < 0 ? glosses.length - 1 : trailing, 1);
    }
    if (!window || !available || !glosses.length)
      return { ...caption, signs: [] };
    const weights = glosses.map(signWeight);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    let durations = weights.map((weight) =>
      Math.min(MAX, Math.max(MIN, (window * weight) / weightSum)),
    );
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    if (total > available && total > glosses.length * MIN) {
      const excess = total - glosses.length * MIN;
      durations = durations.map(
        (duration) =>
          MIN +
          ((duration - MIN) * (available - glosses.length * MIN)) / excess,
      );
    }
    const used = durations.reduce((sum, duration) => sum + duration, 0);
    // Idle belongs inside the caption; overflow is only used when signs need it.
    let cursor = caption.start + Math.max(0, (window - used) / 2);
    const signs = glosses.flatMap((gloss, i) => {
      const start = cursor;
      if (start + MIN > end + EPSILON) return [];
      const duration = Math.max(
        MIN,
        Math.min(durations[i] ?? MIN, end - start),
      );
      cursor += duration;
      return [{ gloss, start, duration }];
    });
    return { ...caption, signs };
  });
}
