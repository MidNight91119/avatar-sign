# SignStream API image. Build from the REPO ROOT (the API uses workspace packages):
#   docker build -f apps/api/Dockerfile -t signstream-api .
#   docker run -p 8787:8787 -v signstream-data:/data --env-file apps/api/.env signstream-api
# Mount a persistent volume at /data: the SQLite cache lives there.

# 1. Install only the API and its workspace dependencies with pnpm (the workspace manager).
FROM node:24-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/sign-assets/package.json packages/sign-assets/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN pnpm install --frozen-lockfile --prod --filter "@signstream/api..."

# 2. Run on Bun (the API's runtime). TypeScript runs directly; no build step.
FROM oven/bun:1.2-slim
WORKDIR /repo
ENV NODE_ENV=production PORT=8787 DATABASE_URL=/data/signstream.sqlite
COPY --from=deps /repo ./
COPY packages/shared packages/shared
COPY packages/sign-assets packages/sign-assets
COPY mocks mocks
COPY apps/api apps/api
RUN mkdir -p /data && chown bun:bun /data
USER bun
EXPOSE 8787
VOLUME /data
WORKDIR /repo/apps/api
CMD ["bun", "src/index.ts"]
