import { SELECTORS, waitForElement } from "./youtube";

export const CONTROL_BUTTON_ID = "signstream-toggle";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A simple open hand, drawn on YouTube's 36×36 control icon grid. */
function handIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-hidden", "true");
  const g = doc.createElementNS(SVG_NS, "g");
  g.setAttribute("fill", "#fff");
  g.setAttribute("transform", "translate(6 6)");
  for (const [x, y, height] of [
    [6.5, 4, 9],
    [9.5, 2.5, 10.5],
    [12.5, 3, 10],
    [15.5, 5, 8.5],
  ] as const) {
    const finger = doc.createElementNS(SVG_NS, "rect");
    finger.setAttribute("x", String(x));
    finger.setAttribute("y", String(y));
    finger.setAttribute("width", "2.4");
    finger.setAttribute("height", String(height));
    finger.setAttribute("rx", "1.2");
    g.append(finger);
  }
  const palm = doc.createElementNS(SVG_NS, "path");
  palm.setAttribute("d", "M6.5 11h11.4v3.5a6 6 0 0 1-6 6h-.3a5.6 5.6 0 0 1-4.6-2.4L4 14.6a1.4 1.4 0 0 1 2.1-1.8l.4.4z");
  g.append(palm);
  svg.append(g);
  return svg;
}

export interface ControlButton {
  setEnabled(enabled: boolean): void;
  /** Adds the button to the player's control bar (waits for the bar to exist). Safe to call repeatedly. */
  ensure(signal: AbortSignal): Promise<void>;
  remove(): void;
}

/** The "SignStream" on/off toggle in YouTube's control bar (`.ytp-right-controls`). */
export function createControlButton(onToggle: () => void, doc: Document = document): ControlButton {
  const button = doc.createElement("button");
  button.id = CONTROL_BUTTON_ID;
  button.type = "button";
  button.className = "ytp-button";
  button.append(handIcon(doc));
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onToggle();
  });

  return {
    setEnabled(enabled) {
      const label = enabled ? "Turn off SignStream (Alt+S)" : "Turn on SignStream (Alt+S)";
      button.setAttribute("aria-pressed", String(enabled));
      button.setAttribute("aria-label", label);
      button.title = label;
      button.style.opacity = enabled ? "1" : "0.5";
    },
    async ensure(signal) {
      const controls = await waitForElement(SELECTORS.rightControls, { root: doc, signal });
      if (button.parentElement !== controls) controls.prepend(button);
    },
    remove() {
      button.remove();
    },
  };
}
