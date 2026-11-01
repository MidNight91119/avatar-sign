import type { PanelSize } from "../settings";

export interface Point {
  left: number;
  top: number;
}
export interface Size {
  width: number;
  height: number;
}

export const PANEL_MARGIN = 16;
export const SNAP_DISTANCE = 40;
export const MIN_PANEL_WIDTH = 160;
export const MAX_PANEL_WIDTH = 560;
export const SIZE_PRESETS: Record<PanelSize, number> = { S: 200, M: 280, L: 360 };

/** What we save in chrome.storage.local. No position means "default corner". */
export interface PanelLayout {
  position?: Point;
  width?: number;
  minimized: boolean;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function normalizeLayout(raw: unknown): PanelLayout {
  const l = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const pos = l.position as Record<string, unknown> | undefined;
  return {
    position: pos && finite(pos.left) && finite(pos.top) ? { left: pos.left, top: pos.top } : undefined,
    width: finite(l.width) ? l.width : undefined,
    minimized: l.minimized === true,
  };
}

export function clampWidth(width: number, viewport: Size): number {
  const max = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, viewport.width - 2 * PANEL_MARGIN));
  return Math.round(Math.min(max, Math.max(MIN_PANEL_WIDTH, width)));
}

/** Keeps the whole panel inside the viewport, `PANEL_MARGIN` from the edges where it fits. Whole pixels, so text stays sharp. */
export function clampPosition(pos: Point, size: Size, viewport: Size): Point {
  const clamp = (value: number, panel: number, view: number) =>
    Math.round(Math.max(PANEL_MARGIN, Math.min(value, view - panel - PANEL_MARGIN)));
  return { left: clamp(pos.left, size.width, viewport.width), top: clamp(pos.top, size.height, viewport.height) };
}

/** After a drag: an edge within `SNAP_DISTANCE` pulls the panel to it, so it settles into corners. */
export function snapToEdges(pos: Point, size: Size, viewport: Size): Point {
  const snap = (value: number, panel: number, view: number) => {
    const far = view - panel - PANEL_MARGIN;
    if (Math.abs(value - PANEL_MARGIN) <= SNAP_DISTANCE) return PANEL_MARGIN;
    if (Math.abs(value - far) <= SNAP_DISTANCE) return far;
    return value;
  };
  return clampPosition(
    { left: snap(pos.left, size.width, viewport.width), top: snap(pos.top, size.height, viewport.height) },
    size,
    viewport,
  );
}

/** Bottom-right corner, like picture-in-picture. */
export function defaultPosition(size: Size, viewport: Size): Point {
  return clampPosition({ left: Infinity, top: Infinity }, size, viewport);
}

/** The resize handle sits on the side away from the nearest screen edge; the other side stays put. */
export function isAnchoredRight(pos: Point, size: Size, viewport: Size): boolean {
  return pos.left + size.width / 2 > viewport.width / 2;
}

export function resizeFrom(
  start: { left: number; width: number },
  dx: number,
  anchoredRight: boolean,
  viewport: Size,
): { left: number; width: number } {
  const width = clampWidth(anchoredRight ? start.width - dx : start.width + dx, viewport);
  return { left: anchoredRight ? start.left + start.width - width : start.left, width };
}
