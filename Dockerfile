FROM oven/bun:1-alpine AS base
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini

FROM base AS install
COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /app/node_modules /app/node_modules
COPY . .
RUN bun run package

FROM base AS release
COPY --from=build /app/dist /app/dist
COPY --from=build /app/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /app/prisma /app/prisma
RUN bunx prisma --help 2>&1 >/dev/null # cache prisma cli to avoid re-downloading on startup
EXPOSE 3000
ENTRYPOINT [ "/sbin/tini", "--", "/docker-entrypoint.sh" ]
