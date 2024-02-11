FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@latest
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY prisma ./prisma
RUN pnpx prisma generate
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output
CMD ["node", ".output/server/index.mjs"]
