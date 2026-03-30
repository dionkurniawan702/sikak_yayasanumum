#!/bin/sh
set -e

echo "[Diagnostic] $(date) - Starting SIKAK Initialization Script..."

# 1. Sync Database Schema
echo "[Diagnostic] $(date) - Running Prisma DB Push..."
npx prisma db push --accept-data-loss

# 2. Run Database Seeding
echo "[Diagnostic] $(date) - Running Database Seeding..."
node prisma/seed_income_items.cjs || echo "[Warning] Seeding failed, but continuing..."

# 3. Start the main application
echo "[Diagnostic] $(date) - Launching SIKAK Backend..."
exec node index.js
