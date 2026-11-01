/** Raashed's API on `pnpm dev`. Replace with the deployed URL once it's shared (hour ~10), or set it in the popup. */
export const DEFAULT_API_BASE_URL = "http://localhost:8787";

/** Origins the background worker may call without CORS. Add the deployed API's origin here if it isn't covered. */
export const API_HOST_PERMISSIONS = [
  "http://localhost/*",
  "http://127.0.0.1/*",
  "https://*.up.railway.app/*",
  "https://*.onrender.com/*",
  "https://*.fly.dev/*",
] as const;

/** PLAN §4.3: the client polls every 2s while the track is processing. */
export const POLL_INTERVAL_MS = 2000;
/** Give up after 5 minutes of `processing`. */
export const MAX_POLL_ATTEMPTS = 150;

export const SIGN_ASSETS_PATH = "sign-assets/";
export const TOGGLE_COMMAND = "toggle-signstream";
