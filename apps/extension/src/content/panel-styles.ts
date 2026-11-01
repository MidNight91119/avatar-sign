// Lives inside the panel's shadow root: YouTube's CSS can't reach in, and ours can't leak out.
export const PANEL_CSS = /* css */ `
:host {
  all: initial;
}
.panel {
  --bg: #0f0f0f;
  --surface: #1f1f1f;
  --stage: #181818;
  --text: #f1f1f1;
  --muted: #aaaaaa;
  --border: rgba(255, 255, 255, 0.12);
  --accent: #3ea6ff;
  --danger: #ff6b6b;
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.4 "Roboto", "Arial", sans-serif;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  user-select: none;
  touch-action: none;
}
.panel[data-theme="light"] {
  --bg: #ffffff;
  --surface: #f2f2f2;
  --stage: #f8f8f8;
  --text: #0f0f0f;
  --muted: #606060;
  --border: rgba(0, 0, 0, 0.12);
  --accent: #065fd4;
  --danger: #cc0000;
}
.panel[hidden] {
  display: none;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 4px 0 10px;
  background: var(--surface);
  cursor: grab;
}
.bar:active {
  cursor: grabbing;
}
.title {
  flex: 1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
button {
  all: unset;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}
button:hover {
  background: var(--border);
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.stage {
  position: relative;
  aspect-ratio: 3 / 4;
  background: var(--stage);
}
.player {
  position: absolute;
  inset: 0;
}
.status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  background: color-mix(in srgb, var(--stage) 88%, transparent);
}
.status[hidden] {
  display: none;
}
.status[data-kind="error"] .status-text {
  color: var(--danger);
}
.status-sub {
  color: var(--muted);
  font-size: 12px;
}
.progress {
  width: 70%;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}
.progress > div {
  height: 100%;
  width: 0;
  background: var(--accent);
  transition: width 0.3s ease;
}
.progress[data-indeterminate] > div {
  width: 30%;
  animation: slide 1.2s ease-in-out infinite;
}
@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(340%); }
}
.gloss {
  min-height: 28px;
  padding: 4px 10px;
  border-top: 1px solid var(--border);
  font-weight: 500;
  letter-spacing: 0.04em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}
.gloss[hidden],
.panel[data-minimized] .stage,
.panel[data-minimized] .gloss,
.panel[data-minimized] .resize {
  display: none;
}
.toast {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: opacity 0.3s ease;
}
.toast[hidden] {
  display: none;
}
.resize {
  position: absolute;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
  background: linear-gradient(45deg, transparent 50%, var(--muted) 50%, var(--muted) 60%, transparent 60%,
    transparent 70%, var(--muted) 70%, var(--muted) 80%, transparent 80%);
  opacity: 0.7;
}
.resize[data-side="left"] {
  left: 0;
  transform: scaleX(-1);
}
.resize[data-side="right"] {
  right: 0;
  cursor: nwse-resize;
}
@media (prefers-reduced-motion: reduce) {
  .progress[data-indeterminate] > div {
    animation: none;
    width: 100%;
    opacity: 0.5;
  }
}
`;
