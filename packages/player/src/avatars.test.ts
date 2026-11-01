import { describe, expect, it } from "bun:test";
import { AVATARS, DEFAULT_AVATAR, avatarIndex } from "./avatars";

describe("avatarIndex", () => {
  it("keeps every real avatar", () => {
    expect(AVATARS.map((_, i) => avatarIndex(i))).toEqual([0, 1, 2]);
  });

  it("falls back to Sara for anything else", () => {
    expect(AVATARS[DEFAULT_AVATAR]).toBe("Sara");
    for (const bad of [undefined, null, -1, 3, 1.5, Number.NaN, "2"]) expect(avatarIndex(bad)).toBe(DEFAULT_AVATAR);
  });
});
