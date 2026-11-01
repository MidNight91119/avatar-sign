import { describe, expect, it } from "bun:test";
import { describeEnv, loadEnv } from "./env";

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(8787);
    expect(env.CEREBRAS_MODEL).toBe("gpt-oss-120b");
    expect(env.CEREBRAS_API_KEY).toBeUndefined();
    expect(env.ALLOWED_ORIGINS).toEqual([]);
    expect(env.MAX_VIDEO_SECONDS).toBe(900);
  });

  it("parses numbers, lists and treats blank keys as missing", () => {
    const env = loadEnv({ PORT: "3001", ALLOWED_ORIGINS: "https://a.dev, https://b.dev ,", EXA_API_KEY: "  " });
    expect(env.PORT).toBe(3001);
    expect(env.ALLOWED_ORIGINS).toEqual(["https://a.dev", "https://b.dev"]);
    expect(env.EXA_API_KEY).toBeUndefined();
  });

  it("throws a readable error for invalid values", () => {
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(/PORT/);
  });
});

describe("describeEnv", () => {
  it("never includes secret values", () => {
    const env = loadEnv({ CEREBRAS_API_KEY: "csk-secret", EXA_API_KEY: "exa-secret", ADMIN_SECRET: "admin-secret" });
    const text = JSON.stringify(describeEnv(env));
    expect(text).not.toContain("secret");
    expect(text).toContain('"CEREBRAS_API_KEY":"set"');
  });
});
