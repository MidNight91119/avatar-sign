import { describe, expect, it } from "bun:test";
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

  it("drops the old user-editable API URL: the API origin is fixed at build time", () => {
    expect(normalizeSettings({ apiBaseUrl: "https://evil.example" })).not.toHaveProperty("apiBaseUrl");
  });
});
