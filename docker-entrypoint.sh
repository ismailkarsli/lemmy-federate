#!/bin/sh
set -e

cd /app
echo "Migrating database"
bunx prisma migrate deploy
echo "Starting server"
ls dist
bun run ./dist/index.js
