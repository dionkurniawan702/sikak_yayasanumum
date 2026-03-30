#!/bin/sh
set -e

echo "[Diagnostic] $(date) - Starting SIKAK Initialization Script..."

# 0. Wait for Database Connectivity
echo "[Diagnostic] $(date) - Waiting for database to be ready..."
# We try to ping the database using prisma, if it fails we wait and retry
MAX_RETRIES=15
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
  if npx prisma db pull --print-schema > /dev/null 2>&1; then
    echo "[Diagnostic] $(date) - Database is reachable!"
    break
  fi
  echo "[Diagnostic] $(date) - Database not ready yet, retrying in 3s ($((COUNT+1))/$MAX_RETRIES)..."
  sleep 3
  COUNT=$((COUNT+1))
done

# 1. Sync Database Schema
echo "[Diagnostic] $(date) - Running Prisma DB Push..."
npx prisma db push --accept-data-loss

# 2. Run Database Seeding
echo "[Diagnostic] $(date) - Running Database Seeding..."
node prisma/seed_income_items.cjs || echo "[Warning] Seeding failed, but continuing..."

# 3. Start the main application
echo "[Diagnostic] $(date) - Launching SIKAK Backend..."
exec node index.js
