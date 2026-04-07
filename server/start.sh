#!/bin/sh
echo "[Diagnostic] $(date) - SIKAK Initialization Start"

# Wait for Database connectivity (optional but recommended for Easypanel)
# We use a simple loop to check if the DB is responding
RETRIES=10
until [ $RETRIES -le 0 ] || ./node_modules/.bin/prisma db push --accept-data-loss > /dev/null 2>&1; do
    echo "[Diagnostic] Waiting for Database to be ready... ($RETRIES retries left)"
    RETRIES=$((RETRIES-1))
    sleep 3
done

PRISMA="./node_modules/.bin/prisma"

echo "[Diagnostic] Running Final Database Sync..."
$PRISMA db push --accept-data-loss || echo "[Error] DB Push failed."

echo "[Diagnostic] Running Final Seeding..."
node prisma/seed_yayasan_final.cjs || echo "[Error] Final Seeding failed."

echo "[Diagnostic] Starting Application Process..."
exec node index.js
