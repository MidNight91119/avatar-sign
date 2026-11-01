/**
 * One request budget per provider account (spec R-I3). Every Cerebras call from every job, every
 * retry and every client goes through the same budget, so simultaneous videos can't add up past
 * the account's rate limit. Free-tier pacing is account-wide, not per video.
 *
 * - at most `concurrency` requests in flight
 * - at most `perMinute` request starts in any 60-second window, and `perHour` in any hour
 * - at most `tokensPerMinute` tokens in any 60-second window: each call is charged an estimate
 *   up front, then its real usage when it returns (the free tier's 30k tokens/min binds before 5 req/min)
 * - a 429 pauses new starts for everyone (Retry-After, or `backoffMs`)
 * Waiting calls start in arrival order.
 */
export interface RequestBudgetOptions {
  perMinute: number;
  /** Optional hourly cap (the free tier allows 150/hour). */
  perHour?: number;
  /** Optional token cap per 60 seconds (the free tier allows 30,000). */
  tokensPerMinute?: number;
  concurrency: number;
  /** Pause after a 429 without a Retry-After header. */
  backoffMs?: number;
  now?: () => number;
  /** Timer used to wait for the window to open (tests pass a fake). */
  setTimer?: (fn: () => void, ms: number) => unknown;
}

export interface BudgetStats {
  started: number;
  inFlight: number;
  queued: number;
  rateLimited: number;
  /** Most requests seen in any 60-second window. */
  peakPerMinute: number;
  peakConcurrency: number;
  /** Most tokens charged in any 60-second window (estimates at start time). */
  peakTokensPerMinute: number;
  /** Tokens charged in the last 60 seconds, with real usage for finished calls. */
  tokensLastMinute: number;
}

export interface CallCost<T> {
  /** Estimated tokens, charged when the call starts. */
  tokens: number;
  /** Real tokens from the response, replacing the estimate. */
  actual?: (result: T) => number | undefined;
}

export interface RequestBudget {
  run<T>(fn: () => Promise<T>, cost?: CallCost<T>): Promise<T>;
  stats(): BudgetStats;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Reads a 429 status and Retry-After (seconds) from an SDK or fetch error, if present. */
export function rateLimitInfo(error: unknown): { limited: boolean; retryAfterMs?: number } {
  if (!error || typeof error !== "object") return { limited: false };
  const e = error as { status?: unknown; headers?: unknown };
  if (e.status !== 429) return { limited: false };
  let raw: string | null | undefined;
  const h = e.headers as { get?: (k: string) => string | null } | Record<string, string> | undefined;
  if (h && typeof (h as { get?: unknown }).get === "function") raw = (h as { get: (k: string) => string | null }).get("retry-after");
  else if (h) raw = (h as Record<string, string>)["retry-after"];
  const seconds = raw == null ? NaN : Number(raw);
  return { limited: true, retryAfterMs: Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined };
}

export function createRequestBudget(opts: RequestBudgetOptions): RequestBudget {
  const now = opts.now ?? Date.now;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const backoffMs = opts.backoffMs ?? 2000;
  const starts: { at: number; tokens: number }[] = [];
  const queue: Array<{ tokens: number; start: (entry: { at: number; tokens: number }) => void }> = [];
  let inFlight = 0;
  let pausedUntil = 0;
  let timerAt = Infinity;
  const stats = { started: 0, rateLimited: 0, peakPerMinute: 0, peakConcurrency: 0, peakTokensPerMinute: 0 };
  const tokenCap = opts.tokensPerMinute ?? Infinity;

  /** When the token window has room for `tokens` more (or is empty: one oversized call may still run alone). */
  function tokensOpenAt(minute: { at: number; tokens: number }[], tokens: number): number {
    let used = minute.reduce((sum, e) => sum + e.tokens, 0);
    if (used + tokens <= tokenCap) return 0;
    for (const e of minute) {
      used -= e.tokens;
      if (used + tokens <= tokenCap || used <= 0) return e.at + MINUTE;
    }
    return 0;
  }

  function pump() {
    for (;;) {
      if (queue.length === 0 || inFlight >= opts.concurrency) return;
      const t = now();
      const keep = opts.perHour ? HOUR : MINUTE;
      while (starts.length && starts[0]!.at <= t - keep) starts.shift();
      const inLastMinute = starts.filter((s) => s.at > t - MINUTE);
      const head = queue[0]!;
      const openAt = Math.max(
        pausedUntil,
        inLastMinute.length >= opts.perMinute ? inLastMinute[inLastMinute.length - opts.perMinute]!.at + MINUTE : 0,
        opts.perHour && starts.length >= opts.perHour ? starts[starts.length - opts.perHour]!.at + HOUR : 0,
        tokensOpenAt(inLastMinute, head.tokens),
      );
      if (openAt > t) {
        if (openAt < timerAt) {
          timerAt = openAt;
          setTimer(() => {
            timerAt = Infinity;
            pump();
          }, openAt - t);
        }
        return;
      }
      const entry = { at: t, tokens: head.tokens };
      starts.push(entry);
      inFlight++;
      stats.started++;
      stats.peakPerMinute = Math.max(stats.peakPerMinute, inLastMinute.length + 1);
      stats.peakConcurrency = Math.max(stats.peakConcurrency, inFlight);
      stats.peakTokensPerMinute = Math.max(stats.peakTokensPerMinute, inLastMinute.reduce((sum, e) => sum + e.tokens, entry.tokens));
      queue.shift()!.start(entry);
    }
  }

  return {
    run<T>(fn: () => Promise<T>, cost?: CallCost<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push({ tokens: cost?.tokens ?? 0, start: (entry) => {
          fn()
            .then((result) => {
              const actual = cost?.actual?.(result);
              if (typeof actual === "number" && Number.isFinite(actual) && actual >= 0) entry.tokens = actual;
              resolve(result);
            }, (error: unknown) => {
              const info = rateLimitInfo(error);
              if (info.limited) {
                stats.rateLimited++;
                pausedUntil = Math.max(pausedUntil, now() + (info.retryAfterMs ?? backoffMs));
              }
              reject(error);
            })
            .finally(() => {
              inFlight--;
              pump();
            });
        } });
        pump();
      });
    },
    stats: () => {
      const t = now();
      const tokensLastMinute = starts.filter((e) => e.at > t - MINUTE).reduce((sum, e) => sum + e.tokens, 0);
      return { ...stats, inFlight, queued: queue.length, tokensLastMinute };
    },
  };
}

/** Defaults per Cerebras tier. Free accounts were observed at 5 requests/min (PLAN §2.2); reconfirm paid quotas in the dashboard. */
export function cerebrasBudgetDefaults(tier: string | undefined): { perMinute: number; perHour?: number; tokensPerMinute?: number; concurrency: number } {
  // Free limits read from x-ratelimit-* headers on 2026-11-01: 5/min, 150/hour, 2400/day, 30k tokens/min.
  return tier === "free"
    ? { perMinute: 5, perHour: 150, tokensPerMinute: 30_000, concurrency: 1 }
    : { perMinute: 60, concurrency: 4 };
}
