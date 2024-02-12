#!/bin/sh
set -e

npx prisma migrate deploy
node .output/server/index.mjs
