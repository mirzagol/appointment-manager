#!/bin/sh
set -e

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding rooms and sessions..."
npx prisma db seed

echo "Starting server..."
node src/index.js
