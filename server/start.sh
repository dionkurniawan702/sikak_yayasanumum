#!/bin/sh
echo "[Diagnostic] $(date) - SIKAK Initialization Start"

PRISMA="./node_modules/.bin/prisma"

echo "[Diagnostic] Running Database Sync (db push)..."
$PRISMA db push --accept-data-loss || echo "[Error] DB Push failed."

echo "[Diagnostic] Running Final Seeding..."
node prisma/seed_yayasan_final.cjs || echo "[Error] Final Seeding failed."

echo "[Diagnostic] Starting Process..."
exec node index.js
