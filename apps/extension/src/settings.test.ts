import { describe, expect, it } from "bun:test";
import { DEFAULT_API_BASE_URL } from "./config";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  it("returns the defaults for missing or junk values", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ enabled: "yes", size: "XL", lang: "BSL", showGloss: 1 })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values", () => {
    const custom = {
      enabled: false,
      size: "L",
      offsetSec: -0.3,
      showGloss: false,
      lang: "ISL",
      apiBaseUrl: "https://signstream.up.railway.app",
      useMockData: true,
    };
    expect(normalizeSettings(custom)).toEqual(custom as typeof DEFAULT_SETTINGS);
  });

  it("clamps the timing offset to ±1s in 0.1s steps", () => {
    expect(normalizeSettings({ offsetSec: 5 }).offsetSec).toBe(1);
    expect(normalizeSettings({ offsetSec: -2 }).offsetSec).toBe(-1);
    expect(normalizeSettings({ offsetSec: 0.34 }).offsetSec).toBe(0.3);
    expect(normalizeSettings({ offsetSec: Number.NaN }).offsetSec).toBe(0);
  });

  it("accepts only http(s) API URLs, without a trailing slash", () => {
    expect(normalizeSettings({ apiBaseUrl: " https://api.example.com/ " }).apiBaseUrl).toBe("https://api.example.com");
    expect(normalizeSettings({ apiBaseUrl: "javascript:alert(1)" }).apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(normalizeSettings({ apiBaseUrl: "not a url" }).apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });
});
