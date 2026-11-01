import { describe, expect, it } from "bun:test";
import { cacheKeys, createSqliteCache } from "./cache";

describe("SQLite cache", () => {
  it("stores and reads JSON values", () => {
    const cache = createSqliteCache(":memory:");
    cache.set("a", { x: 1, list: [1, 2] });
    expect(cache.get<{ x: number; list: number[] }>("a")).toEqual({ x: 1, list: [1, 2] });
    expect(cache.get("missing")).toBeUndefined();
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
  });

  it("expires values after their TTL", () => {
    let t = 1_000_000;
    const cache = createSqliteCache(":memory:", () => t);
    cache.set("short", "v", 60);
    cache.set("forever", "v");
    t += 59_000;
    expect(cache.get("short")).toBe("v");
    t += 2_000;
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("forever")).toBe("v");
  });

  it("lists keys by prefix, escaping LIKE wildcards", () => {
    const cache = createSqliteCache(":memory:");
    cache.set(cacheKeys.track("aaa", "ASL"), 1);
    cache.set(cacheKeys.track("bbb", "ASL"), 1);
    cache.set(cacheKeys.discover("Volcanoes "), 1);
    cache.set("track_x", 1);
    expect(cache.keys("track:")).toEqual(["track:aaa:ASL", "track:bbb:ASL"]);
    expect(cacheKeys.discover("  VOLCANOES")).toBe("discover:volcanoes");
  });
});
