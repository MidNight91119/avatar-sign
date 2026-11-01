# Instructions for AI coding agents (Claude Code, Codex, Cursor, and others)

This repo is a 5-person hackathon project. Each person owns one area. Follow these rules on every task.

## 1. Find out who you are working for
- Read the current branch name: it must be `<owner>/<topic>`, where owner is `raashed`, `hasan`, `durgesh`, `poonam` or `ayush`.
- If you're on `main` or the branch has no owner prefix, **stop and ask** which team member you are working for, then create a branch `<owner>/<topic>` from the latest `origin/main`.
- Read `PLAN.md` and that person's spec in `specs/<owner>.md` before changing anything.

## 2. Start from the latest main
- Run `git fetch origin && git rebase origin/main` before you start, and again before opening a PR.
- If `PLAN.md` or the person's spec changed on main, re-read them; the contracts in PLAN §4 win over anything else.

## 3. Only change the owner's files
- The owner's area is listed in `.github/owners.json`. Change only files in that area, plus the owner's own spec.
- **Never** edit another person's files, `PLAN.md`, other people's specs, or the contracts in `packages/shared`, unless the person explicitly tells you to. If the task needs a change there, stop and say who owns it.
- Work from the mock data (`mocks/`) instead of changing someone else's code to unblock yourself.

## 4. Keep the spec up to date
- When you finish a task from `specs/<owner>.md`, tick its checkbox. If the implementation differs from the spec, write one line under the task saying what changed and why.

## 5. Test before a PR
- Run `pnpm lint`, `pnpm check-types`, `pnpm test` and `pnpm build` from the repo root (Turborepo runs them in every package).
- Workspace: **pnpm** installs and runs root tasks; **Bun** is the runtime and test runner inside individual packages (`bun test`, `bun --watch`). Don't add npm, yarn or bun lockfiles.
- Run every item in the **"PR test cases"** section of the owner's spec and report the results.
- Run `node .github/scripts/pr-check.ts`. CI runs the same check on every PR.

## 6. Commits and PRs are the owner's, not yours
- Commit with the person's own git identity (the repo's `git config user.name` / `user.email`). Don't change the git config.
- **No AI attribution anywhere:** no `Co-authored-by: Claude/Codex/...`, no "Generated with ...", no 🤖. CI rejects commits that have it.
- Use the `commit-message` skill (`.agents/skills/commit-message`) for commit messages, and fill in `.github/pull_request_template.md` for PRs, including which AI tool was used.

## 7. Stack rules
- TypeScript only (strict mode). Use the zod schemas in `packages/shared` for data that crosses packages.
- Secrets stay in `.env`; never commit keys. The Cerebras and Exa budget rules are in PLAN §2.2.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
