/**
 * PR rules for SignStream. Runs in CI on every pull request, and locally with:
 *   node .github/scripts/pr-check.ts
 *
 * Checks:
 *  1. Branch is named <owner>/<topic>, and (in CI) the PR author is that owner
 *  2. Branch contains the latest main (so you are working from the current specs)
 *  3. Changed files are inside the owner's area (.github/owners.json)
 *  4. If you changed code, you also updated your own spec (specs/<owner>.md)
 *     and added or updated test cases (*.test.ts / *.spec.ts) for source changes
 *  5. No AI tool attribution in commit messages or the PR description
 *
 * Escape hatches (PR labels, need a reviewer's OK):
 *  - "cross-team": allows files owned by someone else or team files (PLAN.md, other specs)
 *  - "no-spec-change": allows a code change without a spec update
 *  - "no-tests-needed": allows a source change without test changes (explain why in the PR)
 *
 * Uses only Node built-ins. Node 24 runs this TypeScript file directly.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface Owner {
  github: string;
  spec: string;
  paths: string[];
}
interface OwnersFile {
  sharedPaths: string[];
  teamPaths: string[];
  owners: Record<string, Owner>;
}

const isCI = process.env.GITHUB_ACTIONS === "true";
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const errors: string[] = [];
const warnings: string[] = [];
const fail = (msg: string) => errors.push(msg);
const warn = (msg: string) => warnings.push(msg);

// ---------- inputs ----------
const config: OwnersFile = JSON.parse(readFileSync(".github/owners.json", "utf8"));
const branch = process.env.PR_BRANCH || git("rev-parse", "--abbrev-ref", "HEAD");
const author = process.env.PR_AUTHOR ?? "";
const labels: string[] = JSON.parse(process.env.PR_LABELS || "[]");
const prBody = process.env.PR_BODY ?? "";
const head = process.env.HEAD_SHA || "HEAD";
const base = "origin/main";

if (!isCI) {
  try {
    git("fetch", "--quiet", "origin", "main");
  } catch {
    warn("Could not fetch origin/main; using your local copy of origin/main.");
  }
}

// ---------- glob matching ----------
function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
function matches(file: string, patterns: string[]): boolean {
  let ok = false;
  for (const p of patterns) {
    if (p.startsWith("!")) {
      if (globToRegExp(p.slice(1)).test(file)) ok = false;
    } else if (globToRegExp(p).test(file)) ok = true;
  }
  return ok;
}

// ---------- 1. branch name and author ----------
const ownerName = branch.split("/")[0];
const owner = config.owners[ownerName];
if (!owner || !/^[a-z]+\/[a-z0-9._-]+$/.test(branch)) {
  fail(
    `Branch "${branch}" must be named <owner>/<topic>, where owner is one of: ${Object.keys(config.owners).join(", ")}. Example: poonam/spa-navigation`,
  );
}
if (owner && isCI) {
  if (!owner.github) {
    warn(`No GitHub username set for "${ownerName}" in .github/owners.json, so the PR author can't be checked.`);
  } else if (author.toLowerCase() !== owner.github.toLowerCase()) {
    fail(`Branch belongs to "${ownerName}" (@${owner.github}) but the PR was opened by @${author}. Open PRs only for your own work.`);
  }
}

// ---------- 2. up to date with main ----------
try {
  git("merge-base", "--is-ancestor", base, head);
} catch {
  const behind = git("rev-list", "--count", `${head}..${base}`);
  fail(
    `Your branch is ${behind} commit(s) behind main. Run: git fetch origin && git rebase origin/main. Then re-read PLAN.md and your spec, because they may have changed.`,
  );
}

// ---------- 3. changed files inside the owner's area ----------
const changed = git("diff", "--name-only", `${base}...${head}`).split("\n").filter(Boolean);
if (changed.length === 0) warn("No changed files compared with main.");

if (owner) {
  const outside: string[] = [];
  const team: string[] = [];
  for (const f of changed) {
    if (f === owner.spec || matches(f, config.sharedPaths) || matches(f, owner.paths)) continue;
    if (matches(f, config.teamPaths)) team.push(f);
    else outside.push(f);
  }
  const crossTeam = labels.includes("cross-team");
  if (outside.length) {
    const msg = `Files outside ${ownerName}'s area (see .github/owners.json):\n    ${outside.join("\n    ")}`;
    crossTeam ? warn(`${msg}\n  Allowed by the "cross-team" label; the owner of those files must review.`) : fail(`${msg}\n  Ask the owner to make the change, or add the "cross-team" label and get their review.`);
  }
  if (team.length) {
    const msg = `Team-wide files changed:\n    ${team.join("\n    ")}`;
    crossTeam ? warn(`${msg}\n  Allowed by the "cross-team" label; tell the team in the chat.`) : fail(`${msg}\n  PLAN.md, other people's specs and agent instructions need team agreement: add the "cross-team" label.`);
  }

  // ---------- 4b. test cases added or updated when code changed ----------
  const isTest = (f: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
  const isSource = (f: string) =>
    /^(apps|packages)\//.test(f) &&
    /\.[cm]?[jt]sx?$/.test(f) &&
    !isTest(f) &&
    !/\.d\.ts$/.test(f) &&
    !/(^|\/)[^/]*\.config\.[cm]?[jt]s$/.test(f);
  const sourceChanged = changed.filter((f) => isSource(f) && matches(f, owner.paths));
  const testsChanged = changed.some(isTest);
  if (sourceChanged.length && !testsChanged) {
    labels.includes("no-tests-needed")
      ? warn(`Source code changed without test changes; allowed by the "no-tests-needed" label.`)
      : fail(
          `You changed source code but added or updated no test cases (*.test.ts / *.spec.ts):\n    ${sourceChanged.join("\n    ")}\n  Add tests for the change, or add the "no-tests-needed" label and explain why in the PR description.`,
        );
  }

  // ---------- 4. own spec updated when code changed ----------
  const codeChanged = changed.some((f) => matches(f, owner.paths) && !f.endsWith(".md"));
  const specChanged = changed.includes(owner.spec);
  if (codeChanged && !specChanged) {
    labels.includes("no-spec-change")
      ? warn(`Code changed without updating ${owner.spec}; allowed by the "no-spec-change" label.`)
      : fail(`You changed code but not your spec. Tick the tasks you finished in ${owner.spec} (and note any change to the plan), or add the "no-spec-change" label.`);
  }
}

// ---------- 5. no AI attribution ----------
// Only real attribution lines count: a trailer or "Generated with" line at the START of a line.
// Text that merely mentions these words (like the PR template's checklist) is fine.
const AI_TOOLS = "claude|anthropic|codex|openai|chatgpt|cursor|copilot|gemini|devin|aider|windsurf";
const aiPatterns: RegExp[] = [
  new RegExp(`^\\s*co-authored-by:[^\\n]*\\b(${AI_TOOLS})\\b`, "im"),
  new RegExp(`^\\s*(🤖\\s*)?(generated|created) (with|by|using) \\[?(${AI_TOOLS}|ai)\\b`, "im"),
  /🤖/u,
];
/** The PR template's checklist mentions the forbidden text in backticks; ignore inline code there. */
const withoutInlineCode = (s: string) => s.replace(/`[^`\n]*`/g, "");
const messages = git("log", "--format=%H%n%B%n----END----", `${base}..${head}`);
for (const block of messages.split("----END----")) {
  const [sha, ...body] = block.trim().split("\n");
  const text = body.join("\n");
  if (sha && aiPatterns.some((p) => p.test(text))) {
    fail(`Commit ${sha.slice(0, 7)} has AI tool attribution in its message. Reword it (git rebase -i) without it.`);
  }
}
if (aiPatterns.some((p) => p.test(withoutInlineCode(prBody)))) {
  fail("The PR description has AI tool attribution. Remove it.");
}

// ---------- report ----------
console.log(`PR check for branch "${branch}" (${changed.length} changed file(s))\n`);
for (const w of warnings) console.log(`⚠️  ${w}\n`);
for (const e of errors) console.log(`❌ ${e}\n`);
if (errors.length) {
  console.log(`${errors.length} problem(s). Fix them and push again.`);
  process.exit(1);
}
console.log("✅ All PR rules pass.");
