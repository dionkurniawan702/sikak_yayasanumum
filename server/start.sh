#!/bin/sh
# Simplified startup script without strict exit on error for debugging
echo "[Diagnostic] $(date) - SIKAK Initialization Start"

# Use local prisma binary to avoid npx overhead/issues
PRISMA="./node_modules/.bin/prisma"

echo "[Diagnostic] Checking for Prisma binary at $PRISMA..."
if [ ! -f "$PRISMA" ]; then
    echo "[Error] Prisma binary not found at $PRISMA. Trying fallback..."
    PRISMA="npx prisma"
fi

echo "[Diagnostic] Running Database Sync (db push)..."
$PRISMA db push --accept-data-loss || echo "[Error] DB Push failed. Please check DATABASE_URL."

echo "[Diagnostic] Running Seeding..."
node prisma/seed_income_items.cjs || echo "[Error] Seeding failed."

echo "[Diagnostic] Starting Process..."
exec node index.js
