# Zoen Fly all-in-one: Postgres 18 + RustFS (S3) + Zoen server on one volume.
# Build context: repository root. Do NOT recreate Managed Postgres / Tigris.

FROM node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0 AS build
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends --yes python3 && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM rustfs/rustfs:v1.0.0-rc.5@sha256:b7014e0ce2bc703c1316b3ef760e29dfae61fe4a50d1a66fa89638e0f8ea211f AS rustfs

FROM postgres:18.6-trixie@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280 AS runtime

ARG NODE_VERSION=24.20.0
RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "${arch}" in \
    amd64) node_arch=x64 ;; \
    arm64) node_arch=arm64 ;; \
    *) echo "unsupported arch: ${arch}" >&2; exit 1 ;; \
  esac; \
  apt-get update; \
  apt-get install --no-install-recommends --yes ca-certificates curl xz-utils; \
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1; \
  npm install --global pnpm@11.25.0; \
  apt-get purge --yes curl xz-utils; \
  apt-get autoremove --yes; \
  rm -rf /var/lib/apt/lists/*

COPY --from=rustfs /usr/bin/rustfs /usr/local/bin/rustfs

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/authority/package.json ./packages/authority/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/authority/dist ./packages/authority/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/cli/dist ./apps/cli/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Bootstrap + migrations (TypeScript; Node 24 strip-types) and grant sources.
COPY ops/migrations ./ops/migrations
COPY ops/local/world-policy.ts ./ops/local/world-policy.ts
COPY apps/server/scripts/all-in-one-bootstrap.ts ./apps/server/scripts/all-in-one-bootstrap.ts
COPY ops/containers/all-in-one-entrypoint.sh /usr/local/bin/all-in-one-entrypoint.sh
COPY apps/server/sql ./apps/server/sql
COPY apps/server/src/identity/d01/grants.ts ./apps/server/src/identity/d01/grants.ts

# Let ops/*.ts (migrations bootstrap) resolve apps/server production deps.
RUN ln -sfn /app/apps/server/node_modules /app/ops/node_modules \
  && chmod +x /usr/local/bin/all-in-one-entrypoint.sh /usr/local/bin/rustfs \
  && mkdir -p /data \
  && chown postgres:postgres /data

ENV PGDATA=/data/postgres \
    ZOEN_DATA_ROOT=/data \
    ZOEN_LISTEN_HOST=0.0.0.0 \
    ZOEN_PORT=4310 \
    ZOEN_S3_ENDPOINT=http://127.0.0.1:9000 \
    ZOEN_S3_REGION=us-east-1 \
    ZOEN_S3_BUCKET=zoen \
    ZOEN_INSTALLATION_FILE=/data/zoen/installation.json \
    ZOEN_RUNTIME_ENV_FILE=/data/zoen/runtime.env \
    ZOEN_WORLD_POLICY=d04-hosted-retained-v1 \
    ZOEN_BOOTSTRAP_ADMIN_URL=postgresql://zoen_infra@127.0.0.1:5432/postgres

VOLUME ["/data"]
EXPOSE 4310
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/all-in-one-entrypoint.sh"]
