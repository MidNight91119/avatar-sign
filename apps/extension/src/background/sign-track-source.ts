import { MAX_POLL_ATTEMPTS, POLL_INTERVAL_MS } from "../config";
import { isSignTrack, type SignLang, type SignTrack } from "../contracts";

export class SignTrackError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SignTrackError";
  }
}

export interface PollOptions {
  baseUrl: string;
  videoId: string;
  lang: SignLang;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  fetch?: typeof fetch;
  intervalMs?: number;
  maxAttempts?: number;
  /** Network failures in a row before giving up. */
  maxNetworkFailures?: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function readTrack(res: Response): Promise<SignTrack | undefined> {
  try {
    const body: unknown = await res.json();
    return isSignTrack(body) ? body : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GET /api/sign-track (PLAN §4.3) until the track is `ready` or `error`, reporting progress while it's `processing`.
 * Throws SignTrackError with a code from errors.ts, or the abort reason if `signal` fires.
 */
export async function pollSignTrack(opts: PollOptions): Promise<SignTrack> {
  const {
    baseUrl,
    videoId,
    lang,
    signal,
    onProgress,
    fetch: doFetch = fetch,
    intervalMs = POLL_INTERVAL_MS,
    maxAttempts = MAX_POLL_ATTEMPTS,
    maxNetworkFailures = 3,
  } = opts;
  const url = `${baseUrl}/api/sign-track?${new URLSearchParams({ videoId, lang })}`;
  let networkFailures = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(intervalMs, signal);

    let res: Response;
    try {
      res = await doFetch(url, { signal });
    } catch (err) {
      if (signal?.aborted) throw signal.reason;
      if (++networkFailures >= maxNetworkFailures) throw new SignTrackError("NETWORK");
      continue;
    }
    networkFailures = 0;

    if (res.status === 429) throw new SignTrackError("RATE_LIMITED");
    const track = await readTrack(res);
    if (!track) throw new SignTrackError(res.ok ? "INVALID_RESPONSE" : `HTTP_${res.status}`);

    if (track.status === "ready") return track;
    if (track.status === "error") throw new SignTrackError(track.error ?? "UNKNOWN");
    onProgress?.(Math.min(1, Math.max(0, track.progress ?? 0)));
  }
  throw new SignTrackError("TIMEOUT");
}

type StorageLike = Pick<chrome.storage.StorageArea, "get" | "set">;

/** Ready tracks, cached for the browser session (chrome.storage.session), keyed by language + video. */
export function createTrackCache(area: StorageLike) {
  const key = (videoId: string, lang: SignLang) => `track:${lang}:${videoId}`;
  return {
    async get(videoId: string, lang: SignLang): Promise<SignTrack | undefined> {
      const value = (await area.get(key(videoId, lang)))[key(videoId, lang)];
      return isSignTrack(value) && value.status === "ready" ? value : undefined;
    },
    async set(track: SignTrack): Promise<void> {
      if (track.status === "ready") await area.set({ [key(track.videoId, track.lang)]: track });
    },
  };
}
