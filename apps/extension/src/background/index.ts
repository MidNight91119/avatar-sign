// Background service worker: fetches sign tracks for the content script and the side panel (no CORS problems on
// youtube.com), caches them for the session, opens the side panel from the toolbar icon, and handles Alt+S.
import { TOGGLE_COMMAND } from "../config";
import { SIGN_TRACK_PORT, type SignTrackRequest, type SignTrackUpdate } from "../messages";
import { buildMockTrack } from "../mock-track";
import { loadSettings, saveSettings } from "../settings";
import { createTrackCache, pollSignTrack, SignTrackError } from "./sign-track-source";

const cache = createTrackCache(chrome.storage.session);

async function handleRequest(port: chrome.runtime.Port, req: SignTrackRequest, signal: AbortSignal) {
  const send = (update: SignTrackUpdate) => {
    if (!signal.aborted) port.postMessage(update);
  };

  try {
    const settings = await loadSettings();
    if (settings.useMockData) {
      send({ type: "ready", track: buildMockTrack(req.videoId, req.lang), source: "mock" });
      return;
    }

    const cached = await cache.get(req.videoId, req.lang);
    if (cached) {
      send({ type: "ready", track: cached, source: "cache" });
      return;
    }

    const track = await pollSignTrack({
      baseUrl: settings.apiBaseUrl,
      videoId: req.videoId,
      lang: req.lang,
      signal,
      onProgress: (progress) => send({ type: "progress", progress }),
    });
    await cache.set(track);
    send({ type: "ready", track, source: "api" });
  } catch (err) {
    if (signal.aborted) return;
    console.warn("[SignStream] sign track failed", req.videoId, err);
    send({ type: "error", code: err instanceof SignTrackError ? err.code : "UNKNOWN" });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SIGN_TRACK_PORT) return;
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener((msg: SignTrackRequest) => {
    if (msg?.type === "request") void handleRequest(port, msg, controller.signal);
  });
});

// Clicking the toolbar icon opens the side panel, where the avatar and the settings live.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.commands.onCommand.addListener((command) => {
  if (command !== TOGGLE_COMMAND) return;
  void loadSettings().then((settings) => saveSettings({ enabled: !settings.enabled }));
});
