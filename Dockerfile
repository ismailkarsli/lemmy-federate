FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY prisma ./prisma
RUN pnpx prisma generate
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
