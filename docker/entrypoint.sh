#!/usr/bin/env bash
set -e
echo "Applying database migrations..."
npx prisma migrate deploy
echo "Starting AI service..."
exec node dist/main.js
