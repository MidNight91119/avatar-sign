import { describe, expect, it } from "bun:test";
import type { AvatarPlayer } from "../contracts";
import { buildMockTrack } from "../mock-track";
import { createPlayer } from "./player";

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
  it("prints the current gloss and caption, and follows seeks", () => {
    const container = document.createElement("div");
    const { player } = createPlayer(container, {});
    player.load(buildMockTrack("dQw4w9WgXcQ", "ASL", 60));

    player.tick(0.6); // first sign of "Hello, my name is Bob."
    expect(container.textContent).toContain("HELLO");
    expect(container.textContent).toContain("Hello, my name is Bob.");

    player.tick(0.5 + 3.2); // last slot: FS:BOB
    expect(container.textContent).toContain("B-O-B");

    player.tick(5.6); // next segment, after a seek
    expect(container.textContent).toContain("TOMORROW");

    player.destroy();
    expect(container.childElementCount).toBe(0);
  });
});
