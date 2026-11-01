import { describe, expect, it } from "bun:test";
import {
  clampPosition,
  clampWidth,
  defaultPosition,
  isAnchoredRight,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  normalizeLayout,
  PANEL_MARGIN,
  resizeFrom,
  snapToEdges,
} from "./panel-geometry";

const viewport = { width: 1280, height: 720 };
const size = { width: 280, height: 400 };
const right = viewport.width - size.width - PANEL_MARGIN; // 984
const bottom = viewport.height - size.height - PANEL_MARGIN; // 304

describe("panel geometry", () => {
  it("starts in the bottom-right corner", () => {
    expect(defaultPosition(size, viewport)).toEqual({ left: right, top: bottom });
  });

  it("keeps the panel inside the viewport", () => {
    expect(clampPosition({ left: -50, top: -50 }, size, viewport)).toEqual({ left: PANEL_MARGIN, top: PANEL_MARGIN });
    expect(clampPosition({ left: 5000, top: 5000 }, size, viewport)).toEqual({ left: right, top: bottom });
    expect(clampPosition({ left: 500, top: 200 }, size, viewport)).toEqual({ left: 500, top: 200 });
  });

  it("snaps to an edge when dropped close to it, so it settles into corners", () => {
    expect(snapToEdges({ left: 40, top: 30 }, size, viewport)).toEqual({ left: PANEL_MARGIN, top: PANEL_MARGIN });
    expect(snapToEdges({ left: right - 30, top: bottom - 20 }, size, viewport)).toEqual({ left: right, top: bottom });
    expect(snapToEdges({ left: 500, top: 150 }, size, viewport)).toEqual({ left: 500, top: 150 });
  });

  it("limits the width", () => {
    expect(clampWidth(50, viewport)).toBe(MIN_PANEL_WIDTH);
    expect(clampWidth(5000, viewport)).toBe(MAX_PANEL_WIDTH);
    expect(clampWidth(5000, { width: 400, height: 700 })).toBe(400 - 2 * PANEL_MARGIN);
  });

  it("resizes from the side away from the nearest edge", () => {
    expect(isAnchoredRight({ left: right, top: 0 }, size, viewport)).toBe(true);
    expect(isAnchoredRight({ left: PANEL_MARGIN, top: 0 }, size, viewport)).toBe(false);
    // Anchored right: dragging the left handle left (dx < 0) grows the panel and keeps its right edge still.
    expect(resizeFrom({ left: 984, width: 280 }, -40, true, viewport)).toEqual({ left: 944, width: 320 });
    // Anchored left: dragging the right handle right grows it and keeps the left edge still.
    expect(resizeFrom({ left: 16, width: 280 }, 40, false, viewport)).toEqual({ left: 16, width: 320 });
  });

  it("reads back saved layouts safely", () => {
    expect(normalizeLayout(undefined)).toEqual({ position: undefined, width: undefined, minimized: false });
    expect(normalizeLayout({ position: { left: 10, top: 20 }, width: 300, minimized: true })).toEqual({
      position: { left: 10, top: 20 },
      width: 300,
      minimized: true,
    });
    expect(normalizeLayout({ position: { left: "a" }, width: Infinity })).toEqual({
      position: undefined,
      width: undefined,
      minimized: false,
    });
  });
});
