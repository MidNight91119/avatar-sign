import type { Segment, Sign, SignTrack } from "@signstream/shared";

/** Index of the last item whose start is at or before `t`, or -1. Items must be sorted by start. */
function lastStartingBefore<T extends { start: number }>(items: readonly T[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid]!.start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export interface SignIndex {
  signAt(t: number): Sign | undefined;
  segmentAt(t: number): Segment | undefined;
}

/** Fast "what is being signed at time t" lookups, for the gloss strip and the placeholder player. */
export function createSignIndex(track: Pick<SignTrack, "segments">): SignIndex {
  const byStart = <T extends { start: number }>(a: T, b: T) => a.start - b.start;
  const segments = [...track.segments].sort(byStart);
  const signs = segments.flatMap((segment) => segment.signs).sort(byStart);

  return {
    signAt(t) {
      const sign = signs[lastStartingBefore(signs, t)];
      return sign && t < sign.start + sign.duration ? sign : undefined;
    },
    segmentAt(t) {
      const segment = segments[lastStartingBefore(segments, t)];
      return segment && t < segment.end ? segment : undefined;
    },
  };
}

/** "FS:BOB" → "B-O-B"; anything else is shown as is. */
export function formatGloss(gloss: string): string {
  return gloss.startsWith("FS:") ? [...gloss.slice(3)].join("-") : gloss;
}
