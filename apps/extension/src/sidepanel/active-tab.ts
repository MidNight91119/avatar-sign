import { SIDEPANEL_PORT, type PageInfo, type SidePanelUpdate, type VideoSnapshot } from "../messages";

export interface ActiveTabHandlers {
  /** `null` when the active tab isn't a YouTube page with SignStream running. */
  onPage(page: PageInfo | null): void;
  onVideo(video: VideoSnapshot): void;
}

const RETRY_MS = 1500;

/**
 * Keeps the side panel connected to the content script of its window's active tab: reconnects on tab switches,
 * reloads and navigations. A port that can't connect (not YouTube) is retried in the background.
 * `?tabId=` in the side panel URL pins a tab (for opening the panel as a normal tab while testing).
 */
export function connectToActiveTab(handlers: ActiveTabHandlers): () => void {
  const pinnedTabId = Number(new URLSearchParams(location.search).get("tabId")) || undefined;
  let windowId: number | undefined;
  let tabId: number | undefined;
  let port: chrome.runtime.Port | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const schedule = () => {
    clearTimeout(retry);
    if (!stopped) retry = setTimeout(() => void connect(), RETRY_MS);
  };

  async function connect(force = false) {
    clearTimeout(retry);
    if (stopped) return;
    const id = pinnedTabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (stopped) return;
    if (id === undefined) return schedule();
    if (port && id === tabId && !force) return;

    port?.disconnect();
    tabId = id;
    const next = chrome.tabs.connect(id, { name: SIDEPANEL_PORT });
    port = next;
    next.onMessage.addListener((msg: SidePanelUpdate) => {
      if (msg.type === "page") handlers.onPage(msg.page);
      else handlers.onVideo(msg.video);
    });
    next.onDisconnect.addListener(() => {
      void chrome.runtime.lastError; // "Receiving end does not exist" on non-YouTube tabs; expected
      if (port !== next) return;
      port = undefined;
      handlers.onPage(null);
      schedule();
    });
  }

  const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
    if (!pinnedTabId && info.windowId === windowId) void connect();
  };
  const onUpdated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
    if (id === tabId && change.status === "complete") void connect(true);
  };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);

  void chrome.windows.getCurrent().then((win) => {
    windowId = win.id;
    void connect();
  });

  return () => {
    stopped = true;
    clearTimeout(retry);
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    port?.disconnect();
  };
}
