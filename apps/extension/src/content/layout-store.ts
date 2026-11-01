import { normalizeLayout, type PanelLayout } from "./panel-geometry";

// chrome.storage.local, not sync: a position that fits one screen may not fit another device's.
const LAYOUT_KEY = "panelLayout";

export async function loadLayout(): Promise<PanelLayout> {
  const stored = await chrome.storage.local.get(LAYOUT_KEY);
  return normalizeLayout(stored[LAYOUT_KEY]);
}

export function saveLayout(layout: PanelLayout): void {
  void chrome.storage.local.set({ [LAYOUT_KEY]: layout });
}
