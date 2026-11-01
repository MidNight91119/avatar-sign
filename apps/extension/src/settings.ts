import { SIGN_LANGS, type SignLang } from "@signstream/shared";
import { DEFAULT_API_BASE_URL } from "./config";

export const PANEL_SIZES = ["S", "M", "L"] as const;
export type PanelSize = (typeof PANEL_SIZES)[number];

/** The timing offset slider goes from −1s to +1s in 0.1s steps. */
export const MAX_OFFSET_SEC = 1;

export interface Settings {
  enabled: boolean;
  size: PanelSize;
  /** Added to the video time before it reaches the player. Positive = signs earlier. */
  offsetSec: number;
  showGloss: boolean;
  lang: SignLang;
  apiBaseUrl: string;
  /** Use the built-in mock track instead of calling the API. */
  useMockData: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  size: "M",
  offsetSec: 0,
  showGloss: true,
  lang: "ASL",
  apiBaseUrl: DEFAULT_API_BASE_URL,
  useMockData: false,
};

function normalizeApiBaseUrl(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_API_BASE_URL;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_API_BASE_URL;
    return url.href.replace(/\/+$/, "");
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

function normalizeOffset(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const clamped = Math.min(MAX_OFFSET_SEC, Math.max(-MAX_OFFSET_SEC, value));
  return Math.round(clamped * 10) / 10;
}

/** Turns whatever is in storage (old versions, partial objects, junk) into valid settings. */
export function normalizeSettings(raw: unknown): Settings {
  const s = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULT_SETTINGS.enabled,
    size: PANEL_SIZES.includes(s.size as PanelSize) ? (s.size as PanelSize) : DEFAULT_SETTINGS.size,
    offsetSec: normalizeOffset(s.offsetSec),
    showGloss: typeof s.showGloss === "boolean" ? s.showGloss : DEFAULT_SETTINGS.showGloss,
    lang: SIGN_LANGS.includes(s.lang as SignLang) ? (s.lang as SignLang) : DEFAULT_SETTINGS.lang,
    apiBaseUrl: normalizeApiBaseUrl(s.apiBaseUrl),
    useMockData: typeof s.useMockData === "boolean" ? s.useMockData : DEFAULT_SETTINGS.useMockData,
  };
}

const SETTINGS_KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

/** Replaces all settings. The popup uses this, since it always holds the full, current object. */
export async function writeSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

/** Read-modify-write, for one-off changes outside the popup (toggle button, Alt+S, the panel's close button). */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  await writeSettings(next);
  return next;
}

/** Calls `listener` whenever the popup (or another tab) changes the settings. Returns an unsubscribe function. */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    const change = changes[SETTINGS_KEY];
    if (area === "sync" && change) listener(normalizeSettings(change.newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
