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
EXPOSE 3000
CMD [ "bun", "run", "./dist/index.js" ]
