# syntax=docker/dockerfile:1
# Web image. Build from the repo root (workspaces): docker build -f apps/web/Dockerfile .

FROM node:26.13-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY e2e/package.json e2e/
RUN npm ci --workspace=@catalogue/web --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY apps/web apps/web
# Store name is fixed at build time (CFG-04, ARCHITECTURE §2.4).
ARG VITE_STORE_NAME=Catalogue
ENV VITE_STORE_NAME=${VITE_STORE_NAME}
RUN npm run build --workspace=@catalogue/web

# Static files only; Nginx runs as an unprivileged user on port 8080.
FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
