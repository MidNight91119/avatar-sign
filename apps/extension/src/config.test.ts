import { describe, expect, it } from "bun:test";
import { API_ORIGIN, DEFAULT_API_ORIGIN, normalizeApiOrigin } from "./config";

describe("API origin (fixed at build time)", () => {
  it("defaults to the local API", () => {
    expect(normalizeApiOrigin(undefined)).toBe(DEFAULT_API_ORIGIN);
    expect(API_ORIGIN).toBe(DEFAULT_API_ORIGIN); // no build-time value under bun test
  });

  it("accepts a bare http(s) origin", () => {
    expect(normalizeApiOrigin("https://signstream.up.railway.app")).toBe("https://signstream.up.railway.app");
    expect(normalizeApiOrigin("https://api.example.com/")).toBe("https://api.example.com");
    expect(normalizeApiOrigin("http://localhost:8787")).toBe("http://localhost:8787");
  });

  it("refuses anything that isn't a plain origin, so the build fails loudly", () => {
    for (const bad of ["javascript:alert(1)", "ftp://api.example.com", "https://api.example.com/v1", "https://u@api.example.com", "nope"]) {
      expect(() => normalizeApiOrigin(bad)).toThrow();
    }
  });
});
