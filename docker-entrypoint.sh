#!/bin/sh
set -e

echo "Migrating database"
pnpm exec prisma migrate deploy
echo "Starting server"
pnpm start
