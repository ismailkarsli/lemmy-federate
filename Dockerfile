FROM node:24-alpine AS base
ENV NODE_ENV=production
WORKDIR /app
RUN RUN apk add --no-cache tini openssl curl
COPY package.json ./
RUN corepack enable && corepack install

FROM base AS install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS release
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=install /app/node_modules /app/node_modules
COPY . .
RUN pnpm exec prisma --help > /dev/null # cache prisma cli to avoid re-downloading on startup
RUN pnpm fe:build && pnpm db:generate

EXPOSE 3000
ENTRYPOINT [ "/usr/bin/tini", "--", "/docker-entrypoint.sh" ]
