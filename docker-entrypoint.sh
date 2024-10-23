#!/bin/sh
set -e

cd /app
echo "Migrating database"
bunx prisma migrate deploy
echo "Starting server"
bun run ./dist/index.js
