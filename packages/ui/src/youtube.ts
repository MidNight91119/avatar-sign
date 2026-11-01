const VIDEO_ID = /^[\w-]{11}$/;

/**
 * The 11-character YouTube video ID from a pasted link or a bare ID, or null.
 * Accepts youtube.com/watch?v=, youtu.be/ and /embed/ links, with or without the scheme.
 */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (VIDEO_ID.test(s)) return s;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const id =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : host === "youtube.com" && url.pathname === "/watch"
        ? url.searchParams.get("v")
        : host === "youtube.com" || host === "youtube-nocookie.com"
          ? url.pathname.match(/^\/embed\/([^/]+)/)?.[1]
          : null;
  return id && VIDEO_ID.test(id) ? id : null;
}

/** 75.4 → "01:15" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
