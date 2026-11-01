# SignStream

A sign language avatar for any YouTube video: a Chrome extension and a website. Built with Cerebras and Exa.

- Plan: [PLAN.md](./PLAN.md) · Specs: [specs/](./specs)
- PR rules: [PLAN §9](./PLAN.md#9-working-agreements) · AI agents: [AGENTS.md](./AGENTS.md)

## Setup

Needs Node 24+, pnpm 10 and Bun 1.2+.

```sh
pnpm install
pnpm dev          # run every app
pnpm test         # bun test in each package, through Turborepo
pnpm lint && pnpm check-types && pnpm build
pnpm pr-check     # the same PR rules CI runs
```

**pnpm** manages the workspace; **Bun** is the runtime and test runner inside individual packages.

| Path | What | Owner |
|---|---|---|
| `apps/api` | Hono API on Bun (`src/gloss`: Durgesh) | Raashed |
| `apps/web` | Next.js website | Hasan (Ayush: `/`, `/extension`, `/discover`) |
| `apps/extension` | Chrome MV3 extension | Poonam |
| `packages/player` | Avatar player | Hasan |
| `packages/sign-assets` | Sign clips + dictionary | Hasan |
| `packages/shared` | Shared contracts and API client | Raashed |
| `packages/ui` | Shared React components | Hasan |
| `packages/typescript-config`, `packages/eslint-config` | Shared configs | Raashed |
