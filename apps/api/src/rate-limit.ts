/** In-memory fixed-window rate limiter per key (IP). Enough for one API instance. */
export interface RateLimiter {
  /** Records a hit; returns false when the key is over the limit. */
  hit(key: string): boolean;
  remaining(key: string): number;
}

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  const current = (key: string) => {
    const t = now();
    let w = windows.get(key);
    if (!w || t - w.start >= windowMs) {
      w = { start: t, count: 0 };
      windows.set(key, w);
    }
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k);
    }
    return w;
  };
  return {
    hit(key) {
      const w = current(key);
      if (w.count >= limit) return false;
      w.count++;
      return true;
    },
    remaining(key) {
      return Math.max(0, limit - current(key).count);
    },
  };
}
