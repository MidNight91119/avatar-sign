import { describe, expect, it } from "bun:test";
import { formatOffset } from "./SettingsView";

describe("formatOffset", () => {
  it("shows a signed value in seconds", () => {
    expect(formatOffset(0)).toBe("0.0 s");
    expect(formatOffset(0.3)).toBe("+0.3 s");
    expect(formatOffset(-1)).toBe("−1.0 s");
  });
});
