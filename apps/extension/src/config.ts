/** `apps/api` on `pnpm dev`. Release builds set VITE_SIGNSTREAM_API_ORIGIN to the deployed API. */
export const DEFAULT_API_ORIGIN = "http://localhost:8787";

/**
 * The API origin is fixed at build time (PLAN §11): the worker only ever calls this origin, and the manifest's
 * host permission is exactly this origin. Throws for anything that isn't a plain http(s) origin.
 */
export function normalizeApiOrigin(value: string | undefined): string {
  if (!value) return DEFAULT_API_ORIGIN;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`API origin must be http(s): ${value}`);
  if (url.pathname !== "/" || url.search || url.hash || url.username) throw new Error(`API origin must be a bare origin: ${value}`);
  return url.origin;
}

// Replaced by vite.config.ts at build time; unset under `bun test`.
declare const __SIGNSTREAM_API_ORIGIN__: string | undefined;
export const API_ORIGIN: string =
  typeof __SIGNSTREAM_API_ORIGIN__ === "string" ? __SIGNSTREAM_API_ORIGIN__ : DEFAULT_API_ORIGIN;

/** Give up on a track that is still processing after 5 minutes (the shared client polls every 2s, PLAN §4.3). */
export const TRACK_TIMEOUT_MS = 5 * 60_000;

export const SIGN_ASSETS_PATH = "sign-assets/";
export const TOGGLE_COMMAND = "toggle-signstream";
