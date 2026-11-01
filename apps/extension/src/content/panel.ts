import { h } from "../avatar/dom";
import {
  clampPosition,
  clampWidth,
  defaultPosition,
  isAnchoredRight,
  resizeFrom,
  snapToEdges,
  type PanelLayout,
  type Point,
  type Size,
} from "./panel-geometry";
import { PANEL_CSS } from "./panel-styles";

export const PANEL_HOST_ID = "signstream-root";

export type PanelStatus =
  | { kind: "loading"; text: string; sub?: string; progress?: number }
  | { kind: "error"; text: string }
  | { kind: "paused"; text: string; sub?: string }
  | { kind: "ready" };

export type PanelTheme = "dark" | "light";

export interface PanelOptions {
  doc: Document;
  layout: PanelLayout;
  /** Used when the saved layout has no width (the S/M/L setting). */
  defaultWidth: number;
  theme: PanelTheme;
  showGloss: boolean;
  onLayoutChange(layout: PanelLayout): void;
  onClose(): void;
}

export interface Panel {
  readonly host: HTMLElement;
  /** The player renders in here. */
  readonly playerContainer: HTMLElement;
  /**
   * Appends the panel to `parent` (moves it there if it's already mounted, e.g. into the fullscreen element).
   * `bottomInset` keeps it above anything pinned to the bottom of the screen, like YouTube's fullscreen controls.
   */
  mount(parent: Element, bottomInset?: number): void;
  setStatus(status: PanelStatus): void;
  setGloss(text: string): void;
  /** A small non-blocking note over the stage, e.g. "Preparing more signs… 40%" while a partial track plays. */
  setNote(text: string): void;
  setShowGloss(show: boolean): void;
  setWidth(width: number): void;
  setTheme(theme: PanelTheme): void;
  toast(text: string, durationMs?: number): void;
  /** Re-clamps size and position after the window or fullscreen state changes. */
  fitToViewport(): void;
  destroy(): void;
}

const BAR_HEIGHT = 32;
const GLOSS_HEIGHT = 28;

/** The floating avatar panel: Shadow DOM, draggable by its title bar, resizable, minimizable, snaps to corners. */
export function createPanel(opts: PanelOptions): Panel {
  const { doc } = opts;
  const listeners = new AbortController();
  const { signal } = listeners;

  const host = h(doc, "div", { id: PANEL_HOST_ID });
  const shadow = host.attachShadow({ mode: "open" });

  const minimizeBtn = h(doc, "button", { type: "button", class: "minimize" });
  const closeBtn = h(doc, "button", { type: "button", class: "close", "aria-label": "Turn off SignStream", title: "Turn off SignStream (Alt+S)" }, ["×"]);
  const bar = h(doc, "div", { class: "bar" }, [h(doc, "span", { class: "title" }, ["SignStream"]), minimizeBtn, closeBtn]);
  const playerContainer = h(doc, "div", { class: "player" });
  const statusText = h(doc, "div", { class: "status-text" });
  const statusSub = h(doc, "div", { class: "status-sub" });
  const progressFill = h(doc, "div");
  const progress = h(doc, "div", { class: "progress", hidden: "" }, [progressFill]);
  const status = h(doc, "div", { class: "status", role: "status", "aria-live": "polite", hidden: "" }, [statusText, progress, statusSub]);
  const toastEl = h(doc, "div", { class: "toast", role: "status", hidden: "" });
  const noteEl = h(doc, "div", { class: "note", "aria-live": "polite", hidden: "" });
  const stage = h(doc, "div", { class: "stage" }, [playerContainer, status, noteEl, toastEl]);
  const gloss = h(doc, "div", { class: "gloss", "aria-label": "Current sign" });
  const resizeHandle = h(doc, "div", { class: "resize", "aria-hidden": "true" });
  const panel = h(doc, "section", { class: "panel", role: "region", "aria-label": "SignStream sign language avatar" }, [
    bar,
    stage,
    gloss,
    resizeHandle,
  ]);
  const style = h(doc, "style");
  style.textContent = PANEL_CSS;
  shadow.append(style, panel);

  let width = opts.layout.width ?? opts.defaultWidth;
  let position: Point = opts.layout.position ?? { left: 0, top: 0 };
  let userPlaced = opts.layout.position !== undefined;
  let minimized = opts.layout.minimized;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let bottomInset = 0;

  const viewport = (): Size => ({
    width: doc.documentElement.clientWidth || window.innerWidth,
    height: (doc.documentElement.clientHeight || window.innerHeight) - bottomInset,
  });
  const size = (): Size => {
    const rect = panel.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };
    const body = minimized ? 0 : (width * 4) / 3 + (gloss.hidden ? 0 : GLOSS_HEIGHT);
    return { width, height: BAR_HEIGHT + body };
  };

  const render = () => {
    panel.style.width = `${width}px`;
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.toggleAttribute("data-minimized", minimized);
    minimizeBtn.textContent = minimized ? "▢" : "–";
    minimizeBtn.setAttribute("aria-label", minimized ? "Restore SignStream panel" : "Minimize SignStream panel");
    minimizeBtn.setAttribute("aria-expanded", String(!minimized));
    resizeHandle.dataset.side = isAnchoredRight(position, size(), viewport()) ? "left" : "right";
  };

  const save = () =>
    opts.onLayoutChange({ position: userPlaced ? { ...position } : undefined, width, minimized });

  const fitToViewport = () => {
    const vp = viewport();
    width = clampWidth(width, vp);
    panel.style.width = `${width}px`;
    position = userPlaced ? clampPosition(position, size(), vp) : defaultPosition(size(), vp);
    render();
  };

  /** Pointer drag helper: calls `onMove` with the pointer delta, `onEnd` once on release. */
  const drag = (el: HTMLElement, onStart: (e: PointerEvent) => boolean, onMove: (dx: number, dy: number) => void, onEnd: () => void) => {
    el.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0 || !onStart(e)) return;
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const gesture = new AbortController();
        el.setPointerCapture?.(e.pointerId);
        el.addEventListener("pointermove", (ev) => onMove(ev.clientX - startX, ev.clientY - startY), { signal: gesture.signal });
        const end = () => {
          gesture.abort();
          onEnd();
        };
        el.addEventListener("pointerup", end, { signal: gesture.signal });
        el.addEventListener("pointercancel", end, { signal: gesture.signal });
      },
      { signal },
    );
  };

  let dragStart: Point = position;
  drag(
    bar,
    (e) => {
      if ((e.target as Element | null)?.closest("button")) return false;
      dragStart = position;
      return true;
    },
    (dx, dy) => {
      position = clampPosition({ left: dragStart.left + dx, top: dragStart.top + dy }, size(), viewport());
      render();
    },
    () => {
      userPlaced = true;
      position = snapToEdges(position, size(), viewport());
      render();
      save();
    },
  );

  let resizeStart = { left: 0, width: 0, anchoredRight: false };
  drag(
    resizeHandle,
    () => {
      resizeStart = { left: position.left, width, anchoredRight: isAnchoredRight(position, size(), viewport()) };
      return true;
    },
    (dx) => {
      const next = resizeFrom(resizeStart, dx, resizeStart.anchoredRight, viewport());
      width = next.width;
      panel.style.width = `${width}px`;
      position = clampPosition({ left: next.left, top: position.top }, size(), viewport());
      render();
    },
    () => {
      userPlaced = true;
      save();
    },
  );

  minimizeBtn.addEventListener(
    "click",
    () => {
      minimized = !minimized;
      fitToViewport();
      save();
    },
    { signal },
  );
  closeBtn.addEventListener("click", () => opts.onClose(), { signal });

  panel.dataset.theme = opts.theme;
  gloss.hidden = !opts.showGloss;

  return {
    host,
    playerContainer,
    mount(parent, inset = 0) {
      if (signal.aborted) return; // destroyed
      if (host.parentNode !== parent) parent.append(host);
      bottomInset = inset;
      fitToViewport();
    },
    setStatus(next) {
      status.hidden = next.kind === "ready";
      status.dataset.kind = next.kind;
      if (next.kind === "ready") return;
      statusText.textContent = next.text;
      statusSub.textContent = "sub" in next ? (next.sub ?? "") : "";
      progress.hidden = next.kind !== "loading";
      if (next.kind === "loading") {
        progress.toggleAttribute("data-indeterminate", next.progress === undefined);
        progressFill.style.width = next.progress === undefined ? "" : `${Math.round(next.progress * 100)}%`;
      }
    },
    setGloss(text) {
      if (gloss.textContent !== text) gloss.textContent = text;
    },
    setNote(text) {
      noteEl.hidden = !text;
      if (noteEl.textContent !== text) noteEl.textContent = text;
    },
    setShowGloss(show) {
      if (gloss.hidden === !show) return;
      gloss.hidden = !show;
      fitToViewport();
    },
    setWidth(next) {
      const vp = viewport();
      const anchoredRight = isAnchoredRight(position, size(), vp);
      const right = position.left + width;
      width = clampWidth(next, vp);
      if (anchoredRight) position = { left: right - width, top: position.top };
      fitToViewport();
      save();
    },
    setTheme(theme) {
      panel.dataset.theme = theme;
    },
    toast(text, durationMs = 3000) {
      clearTimeout(toastTimer);
      toastEl.textContent = text;
      toastEl.hidden = false;
      toastTimer = setTimeout(() => (toastEl.hidden = true), durationMs);
    },
    fitToViewport,
    destroy() {
      listeners.abort();
      clearTimeout(toastTimer);
      host.remove();
    },
  };
}
