# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack install --global pnpm@11.15.0
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile
COPY package.json ./package.json
RUN pnpm install --offline --frozen-lockfile
COPY src ./src
COPY public ./public
COPY drizzle ./drizzle
COPY tsconfig.json vite.config.ts ./
RUN pnpm build

FROM centrifugo/centrifugo:v6.9.1 AS centrifugo

FROM node:24-alpine
LABEL org.opencontainers.image.title="Sealed Lists" \
      org.opencontainers.image.description="Sealed army list escrow: everyone submits hidden, all lists reveal at once and lock." \
      org.opencontainers.image.source="https://github.com/richardsolomou/sealed-lists" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
WORKDIR /app
RUN apk add --no-cache tini && mkdir -p /data && chown -R node:node /app /data
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=centrifugo /usr/local/bin/centrifugo /usr/local/bin/centrifugo
COPY --chown=node:node centrifugo.json ./centrifugo.json
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/sealed-lists-entrypoint
COPY --chown=node:node LICENSE ./
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health && wget -q --spider http://127.0.0.1:8000/health || exit 1
USER node
ENTRYPOINT ["/sbin/tini", "-g", "--", "/usr/local/bin/sealed-lists-entrypoint"]
