# don't use alpine for now: https://github.com/oven-sh/bun/issues/13983, https://github.com/oven-sh/bun/issues/14292
FROM oven/bun:1-slim AS base
ENV NODE_ENV=production
WORKDIR /app
RUN apt update && apt install -y tini && rm -rf /var/lib/apt/lists/*

FROM base AS install
COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

FROM base AS release
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=install /app/node_modules /app/node_modules
COPY . .
RUN bunx prisma --help >/dev/null # cache prisma cli to avoid re-downloading on startup
RUN bun fe:build && bun db:generate
EXPOSE 3000
ENTRYPOINT [ "/usr/bin/tini", "--", "/docker-entrypoint.sh" ]
