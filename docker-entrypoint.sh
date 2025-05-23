#!/bin/sh
set -e

echo "Migrating database"
npx prisma migrate deploy
echo "Starting server"
pnpm start
