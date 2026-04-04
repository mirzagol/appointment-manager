#!/bin/sh
set -e

BACKEND_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$BACKEND_ROOT"

echo "Running migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Seeding rooms and sessions..."
npx prisma db seed --schema=./prisma/schema.prisma

echo "Starting server..."
exec node src/index.js
