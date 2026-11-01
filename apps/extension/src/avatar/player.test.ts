import { describe, expect, it } from "bun:test";
import { sampleTrack } from "../../test/fixtures";
import { createPlayer, type AvatarPlayer } from "./player";

describe("createPlayer", () => {
  it("falls back to the gloss placeholder while @signstream/player has no createAvatarPlayer", () => {
    const container = document.createElement("div");
    const { kind } = createPlayer(container, {});
    expect(kind).toBe("placeholder");
  });

  it("uses Hasan's player as soon as the package exports it", () => {
    const fake = { destroy() {} } as AvatarPlayer;
    const options: unknown[] = [];
    const { player, kind } = createPlayer(document.createElement("div"), { lang: "ASL", assetsBaseUrl: "x/" }, {
      createAvatarPlayer: (_container: HTMLElement, opts: unknown) => {
        options.push(opts);
        return fake;
      },
    });
    expect(kind).toBe("avatar");
    expect(player).toBe(fake);
    expect(options).toEqual([{ lang: "ASL", assetsBaseUrl: "x/" }]);
  });

  it("falls back if the avatar fails to start (e.g. no WebGL)", () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const { kind } = createPlayer(document.createElement("div"), {}, {
        createAvatarPlayer: () => {
          throw new Error("WebGL not available");
        },
      });
      expect(kind).toBe("placeholder");
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("placeholder player", () => {
  it("is labelled as a placeholder, prints the current gloss and caption, and follows seeks", () => {
    const container = document.createElement("div");
    const { player } = createPlayer(container, {});
    player.load(sampleTrack());
    expect(container.textContent).toContain("Placeholder");

    player.tick(0.3); // HELLO 0–0.6
    expect(container.textContent).toContain("HELLO");
    expect(container.textContent).toContain("Hello everyone, my name is Bob.");

    player.tick(2.5); // FS:BOB 2–3.05
    expect(container.textContent).toContain("B-O-B");

    player.tick(3.3); // next segment: TODAY 3.2–3.8
    expect(container.textContent).toContain("TODAY");

    player.destroy();
    expect(container.childElementCount).toBe(0);
  });
});
