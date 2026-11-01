import { afterEach, describe, expect, it } from "bun:test";
import { createPanel, PANEL_HOST_ID, type Panel } from "./panel";
import { PANEL_MARGIN, type PanelLayout } from "./panel-geometry";

let panel: Panel | undefined;
afterEach(() => {
  panel?.destroy();
  panel = undefined;
});

function setup(layout: PanelLayout = { minimized: false }) {
  const saved: PanelLayout[] = [];
  let closed = 0;
  panel = createPanel({
    doc: document,
    layout,
    defaultWidth: 280,
    theme: "dark",
    showGloss: true,
    onLayoutChange: (l) => saved.push(l),
    onClose: () => closed++,
  });
  panel.mount(document.body);
  const root = panel.host.shadowRoot!;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  return { panel, root, $, saved, closedCount: () => closed };
}

const pointer = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, pointerId: 1 }));

describe("createPanel", () => {
  it("mounts once, inside a shadow root", () => {
    const { panel, root } = setup();
    expect(document.querySelectorAll(`#${PANEL_HOST_ID}`).length).toBe(1);
    expect(root.querySelector(".panel")).not.toBeNull();
    expect(panel.playerContainer.getRootNode()).toBe(root);
    // Moving it (e.g. into the fullscreen element) doesn't duplicate it.
    const fullscreen = document.createElement("div");
    document.body.append(fullscreen);
    panel.mount(fullscreen);
    expect(document.querySelectorAll(`#${PANEL_HOST_ID}`).length).toBe(1);
    expect(panel.host.parentElement).toBe(fullscreen);
    fullscreen.remove();
  });

  it("stays above YouTube's fullscreen controls", () => {
    const { panel, $ } = setup();
    const top = parseFloat($(".panel").style.top);
    panel.mount(document.body, 80);
    expect(parseFloat($(".panel").style.top)).toBe(top - 80);
    panel.mount(document.body);
    expect(parseFloat($(".panel").style.top)).toBe(top);
  });

  it("shows loading progress, errors, and hides the overlay when ready", () => {
    const { panel, $ } = setup();
    panel.setStatus({ kind: "loading", text: "Preparing signs… 40%", sub: "Translating with Cerebras · 1.2s", progress: 0.4 });
    expect($(".status").hidden).toBe(false);
    expect($(".status-text").textContent).toBe("Preparing signs… 40%");
    expect($(".status-sub").textContent).toBe("Translating with Cerebras · 1.2s");
    expect($(".progress > div").style.width).toBe("40%");

    panel.setStatus({ kind: "error", text: "No captions available for this video" });
    expect($(".status").dataset.kind).toBe("error");
    expect($(".progress").hidden).toBe(true);
    expect($(".status-sub").textContent).toBe("");

    panel.setStatus({ kind: "ready" });
    expect($(".status").hidden).toBe(true);
  });

  it("shows and hides the gloss strip", () => {
    const { panel, $ } = setup();
    panel.setGloss("B-O-B");
    expect($(".gloss").textContent).toBe("B-O-B");
    panel.setShowGloss(false);
    expect($(".gloss").hidden).toBe(true);
  });

  it("minimizes and remembers it", () => {
    const { $, saved } = setup();
    $("button.minimize").click();
    expect($(".panel").hasAttribute("data-minimized")).toBe(true);
    expect($("button.minimize").getAttribute("aria-expanded")).toBe("false");
    expect(saved.at(-1)?.minimized).toBe(true);
  });

  it("turns SignStream off from the close button", () => {
    const { $, closedCount } = setup();
    $("button.close").click();
    expect(closedCount()).toBe(1);
  });

  it("drags by the title bar, snaps to the corner, and saves the position", () => {
    const { $, saved } = setup();
    const bar = $(".bar");
    pointer(bar, "pointerdown", 900, 400);
    pointer(bar, "pointermove", 100, 100);
    pointer(bar, "pointermove", -500, -500);
    pointer(bar, "pointerup", -500, -500);
    expect($(".panel").style.left).toBe(`${PANEL_MARGIN}px`);
    expect($(".panel").style.top).toBe(`${PANEL_MARGIN}px`);
    expect(saved.at(-1)?.position).toEqual({ left: PANEL_MARGIN, top: PANEL_MARGIN });

    // Moving the pointer after release does nothing.
    pointer(bar, "pointermove", 600, 600);
    expect($(".panel").style.left).toBe(`${PANEL_MARGIN}px`);
  });

  it("restores a saved position and width", () => {
    const { $ } = setup({ position: { left: 200, top: 100 }, width: 320, minimized: false });
    expect($(".panel").style.left).toBe("200px");
    expect($(".panel").style.top).toBe("100px");
    expect($(".panel").style.width).toBe("320px");
  });

  it("changes width from the size setting", () => {
    const { panel, $, saved } = setup();
    panel.setWidth(360);
    expect($(".panel").style.width).toBe("360px");
    expect(saved.at(-1)?.width).toBe(360);
  });

  it("follows the YouTube theme", () => {
    const { panel, $ } = setup();
    expect($(".panel").dataset.theme).toBe("dark");
    panel.setTheme("light");
    expect($(".panel").dataset.theme).toBe("light");
  });

  it("removes itself on destroy", () => {
    const { panel } = setup();
    panel.destroy();
    expect(document.getElementById(PANEL_HOST_ID)).toBeNull();
  });
});
