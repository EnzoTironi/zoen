FROM node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0 AS build
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends --yes python3 && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0 AS runtime
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/application-client/package.json ./packages/application-client/package.json
COPY packages/ontology/package.json ./packages/ontology/package.json
COPY packages/oms/package.json ./packages/oms/package.json
COPY packages/actions/package.json ./packages/actions/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/mcp/package.json ./apps/mcp/package.json
COPY apps/web/package.json ./apps/web/package.json
# Build tools run only in the build stage; runtime packages still receive the locked patches.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/application-client/dist ./packages/application-client/dist
COPY --from=build /app/packages/ontology/dist ./packages/ontology/dist
COPY --from=build /app/packages/oms/dist ./packages/oms/dist
COPY --from=build /app/packages/actions/dist ./packages/actions/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/cli/dist ./apps/cli/dist
COPY --from=build /app/apps/mcp/dist ./apps/mcp/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 4310
CMD ["node", "apps/server/dist/main.js"]
