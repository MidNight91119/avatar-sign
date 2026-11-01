// Content script for youtube.com: wires the app to the real Chrome APIs.
import { createPlayer } from "../avatar/player";
import { SIGN_ASSETS_PATH } from "../config";
import { SIDEPANEL_PORT } from "../messages";
import { loadSettings, onSettingsChanged, saveSettings } from "../settings";
import { requestSignTrack } from "../track-client";
import { startApp } from "./app";
import { loadLayout, saveLayout } from "./layout-store";
import { createSidebarHub, linkFromPort } from "./sidebar-link";

// Registered right away: the side panel may connect while the app is still loading settings.
const sidebar = createSidebarHub();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === SIDEPANEL_PORT) sidebar.accept(linkFromPort(port));
});

startApp({
  doc: document,
  win: window,
  settings: { load: loadSettings, save: saveSettings, subscribe: onSettingsChanged },
  layout: { load: loadLayout, save: saveLayout },
  sidebar,
  requestTrack: requestSignTrack,
  createPlayer,
  assetsBaseUrl: chrome.runtime.getURL(SIGN_ASSETS_PATH),
}).catch((err: unknown) => console.warn("[SignStream] failed to start", err));
