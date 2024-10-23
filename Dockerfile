# don't use alpine for now: https://github.com/oven-sh/bun/issues/13983, https://github.com/oven-sh/bun/issues/14292
FROM oven/bun:1-slim AS base
ENV NODE_ENV=production
WORKDIR /app
RUN apt update && apt install -y tini && rm -rf /var/lib/apt/lists/*

FROM base AS install
COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /app/node_modules /app/node_modules
COPY . .
RUN bun run package

FROM base AS release
COPY --from=build /app/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /app/dist /app/dist
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/node_modules /app/node_modules
RUN bunx prisma --help >/dev/null # cache prisma cli to avoid re-downloading on startup
EXPOSE 3000
ENTRYPOINT [ "/usr/bin/tini", "--", "/docker-entrypoint.sh" ]
