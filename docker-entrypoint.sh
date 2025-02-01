#!/bin/sh
set -e

echo "Migrating database"
bunx prisma migrate deploy
echo "Starting server"
bun run ./src/index.ts
