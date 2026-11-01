// Background service worker: fetches sign tracks for the content script and the side panel (no CORS problems on
// youtube.com), caches them for the session, opens the side panel from the toolbar icon, and handles Alt+S.
// It keeps no state that must survive suspension: each port request starts from the cache and the API.
import { API_ORIGIN, TOGGLE_COMMAND } from "../config";
import { SIGN_TRACK_PORT, SignTrackRequestSchema, type SignTrackRequest, type SignTrackUpdate } from "../messages";
import { loadSettings, saveSettings } from "../settings";
import { createTrackCache, loadSignTrack, SignTrackFailure } from "./sign-track-source";

const cache = createTrackCache(chrome.storage.session);

async function handleRequest(port: chrome.runtime.Port, req: SignTrackRequest, signal: AbortSignal) {
  const send = (update: SignTrackUpdate) => {
    if (!signal.aborted) port.postMessage(update);
  };
  const { requestId } = req;

  try {
    const settings = await loadSettings();
    const { track, source } = await loadSignTrack({
      videoId: req.videoId,
      lang: req.lang,
      mock: settings.useMockData,
      apiOrigin: API_ORIGIN,
      cache,
      signal,
      onProgress: (progress) => send({ type: "progress", requestId, progress }),
      onPartial: (partial) => send({ type: "partial", requestId, track: partial }),
    });
    send({ type: "ready", requestId, track, source });
  } catch (err) {
    if (signal.aborted) return;
    console.warn("[SignStream] sign track failed", req.videoId, err);
    send({ type: "error", requestId, code: err instanceof SignTrackFailure ? err.code : "INTERNAL" });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SIGN_TRACK_PORT || port.sender?.id !== chrome.runtime.id) return;
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener((msg: unknown) => {
    const parsed = SignTrackRequestSchema.safeParse(msg);
    if (!parsed.success) {
      console.warn("[SignStream] ignored an invalid sign-track request", parsed.error.issues);
      port.disconnect();
      return;
    }
    void handleRequest(port, parsed.data, controller.signal);
  });
});

// Clicking the toolbar icon opens the side panel, where the avatar and the settings live.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.commands.onCommand.addListener((command) => {
  if (command !== TOGGLE_COMMAND) return;
  void loadSettings().then((settings) => saveSettings({ enabled: !settings.enabled }));
});
