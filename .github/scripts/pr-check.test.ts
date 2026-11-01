// Tests for the AI attribution patterns in pr-check.ts (run: bun test .github/scripts).
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

// Pull the pattern block out of the script so the test checks the real patterns.
const src = readFileSync(new URL("./pr-check.ts", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const AI_TOOLS"), src.indexOf("const messages"));
const { aiPatterns, withoutInlineCode } = new Function(
  `${block.replace(/: RegExp\[\]/, "").replace(/\(s: string\)/, "(s)")}; return { aiPatterns, withoutInlineCode };`,
)() as { aiPatterns: RegExp[]; withoutInlineCode: (s: string) => string };

const flagged = (text: string) => aiPatterns.some((p) => p.test(withoutInlineCode(text)));
const template = readFileSync(new URL("../pull_request_template.md", import.meta.url), "utf8");

describe("AI attribution detection", () => {
  it("flags real trailers and generated-with lines", () => {
    expect(flagged("feat: x\n\nCo-authored-by: Claude <noreply@anthropic.com>")).toBe(true);
    expect(flagged("Body\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)")).toBe(true);
    expect(flagged("Generated with Codex.")).toBe(true);
    expect(flagged("Co-authored-by: Codex <noreply@openai.com>")).toBe(true);
  });

  it("does not flag the PR template or ordinary mentions", () => {
    expect(flagged(template)).toBe(false);
    expect(flagged("- [x] AI tool used: Claude Code; reviewed every change; no AI attribution")).toBe(false);
    expect(flagged("Co-authored-by: Hasan <hasan@example.com>")).toBe(false);
  });
});
