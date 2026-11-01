import type { AvatarPlayer } from "./player";
import { createSignIndex, formatGloss, type SignIndex } from "../track";
import { h } from "./dom";

/**
 * Stand-in for Hasan's avatar (spec: "a placeholder <div> that prints the current gloss as text").
 * Same interface as the real player, so the sync loop can be tested on its own.
 */
export function createPlaceholderPlayer(container: HTMLElement): AvatarPlayer {
  const doc = container.ownerDocument;
  const glossEl = h(doc, "div");
  const captionEl = h(doc, "div");
  // Reviewers and demo viewers must not mistake this for the signing avatar.
  const label = h(doc, "div", {}, ["Placeholder: gloss text until the avatar is ready"]);
  const root = h(doc, "div", { "data-signstream-placeholder": "" }, [label, glossEl, captionEl]);
  Object.assign(root.style, {
    position: "absolute",
    inset: "0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "16px",
    textAlign: "center",
  });
  Object.assign(label.style, {
    position: "absolute",
    top: "10px",
    left: "0",
    right: "0",
    fontSize: "11px",
    color: "var(--muted)",
  });
  Object.assign(glossEl.style, { fontSize: "28px", fontWeight: "700", letterSpacing: "0.05em", minHeight: "36px" });
  Object.assign(captionEl.style, { fontSize: "12px", color: "var(--muted)", minHeight: "34px" });
  container.append(root);

  let index: SignIndex | undefined;

  return {
    load(track) {
      index = createSignIndex(track);
    },
    tick(t) {
      if (!index) return;
      const sign = index.signAt(t);
      const text = sign ? formatGloss(sign.gloss) + (sign.nonManual === "question" ? " ?" : "") : "";
      if (glossEl.textContent !== text) glossEl.textContent = text;
      const caption = index.segmentAt(t)?.text ?? "";
      if (captionEl.textContent !== caption) captionEl.textContent = caption;
    },
    setSpeed() {},
    play() {
      root.style.opacity = "1";
    },
    pause() {
      root.style.opacity = "0.6";
    },
    playSign(gloss) {
      glossEl.textContent = formatGloss(gloss);
    },
    destroy() {
      index = undefined;
      root.remove();
    },
  };
}
