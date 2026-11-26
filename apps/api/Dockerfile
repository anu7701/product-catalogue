# syntax=docker/dockerfile:1
# API image. Build from the repo root (workspaces): docker build -f apps/api/Dockerfile .
# No compile step: Node runs the TypeScript sources directly (T16).

FROM node:26.13-alpine AS deps
WORKDIR /app
# Every workspace manifest is needed for `npm ci` to accept the lockfile.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Production dependencies of the API and the shared package only.
RUN npm ci --omit=dev --workspace=@catalogue/api --ignore-scripts --no-audit --no-fund

FROM node:26.13-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
# Run as the image's unprivileged user.
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
CMD ["node", "apps/api/src/main.ts"]
