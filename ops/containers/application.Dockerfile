FROM node:26.8.1-trixie-slim@sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146 AS build
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends --yes python3 && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:26.8.1-trixie-slim@sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146 AS runtime
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/authority/package.json ./packages/authority/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/web/package.json ./apps/web/package.json
# Build tools run only in the build stage; runtime packages still receive the locked patches.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/authority/dist ./packages/authority/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/cli/dist ./apps/cli/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 4310
CMD ["node", "apps/server/dist/main.js"]
