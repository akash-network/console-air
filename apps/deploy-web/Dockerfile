# syntax=docker/dockerfile:1.7

# Build stage
FROM node:22-bookworm AS builder

WORKDIR /repo

# Pin npm to the version the repo declares in `packageManager` so lockfile
# resolution (esp. root `overrides`) matches what works on the maintainer's box.
# node:22-bookworm ships npm 10.x, which resolves overrides differently and
# fails `npm ci` with "Missing: zod@3.23.8 from lock file".
RUN npm install -g npm@11.11.0

# Install workspace deps. Copy the whole repo so npm can resolve workspace links
# in package-lock.json. (Selective package.json copying is brittle in this monorepo
# because several packages depend on each other by workspace path.)
COPY . .

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Next.js + webpack on this monorepo OOMs at Node's default ~2 GB heap.
# 6 GB gives plenty of headroom. If your Docker daemon's overall memory
# allocation is smaller (e.g. the default 2 GB on Docker Desktop), raise
# it to at least ~8 GB or the build will be OOM-killed by the runtime.
ENV NODE_OPTIONS=--max-old-space-size=6144

# Next.js produces a standalone bundle at apps/deploy-web/.next/standalone/
RUN npm run build

# Runtime stage
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0

# Next standalone output already contains a minimal node_modules with only the
# files the server needs. Copy the bundle, then the static assets and public
# files into the locations server.js expects.
COPY --from=builder /repo/apps/deploy-web/.next/standalone/ ./
COPY --from=builder /repo/apps/deploy-web/.next/static/ ./apps/deploy-web/.next/static/
COPY --from=builder /repo/apps/deploy-web/public/ ./apps/deploy-web/public/

RUN useradd --system --uid 1001 --no-create-home nextjs \
 && chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3001

CMD ["node", "apps/deploy-web/server.js"]
