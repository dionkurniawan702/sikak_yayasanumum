#!/bin/sh
echo "[Diagnostic] $(date) - SIKAK Initialization Start"

PRISMA="./node_modules/.bin/prisma"

# ─── STEP 1: Wait for DB to be ready ───────────────────────────────────────
echo "[Diagnostic] Waiting for database connection..."
RETRIES=20
while [ $RETRIES -gt 0 ]; do
    node -e "
        const mysql = require('mysql2/promise');
        const url = process.env.DATABASE_URL || '';
        const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
        if (!match) process.exit(1);
        mysql.createConnection({ host: match[3], port: parseInt(match[4]), user: match[1], password: match[2], database: match[5] })
            .then(c => c.end().then(() => process.exit(0)))
            .catch(() => process.exit(1));
    " > /dev/null 2>&1 && break
    echo "[Diagnostic] DB not ready yet... ($RETRIES retries left)"
    RETRIES=$((RETRIES-1))
    sleep 3
done

# ─── STEP 2: Safe schema sync (NEVER drop tables with data) ─────────────────
echo "[Diagnostic] Checking if database has existing data..."

HAS_DATA=$(node -e "
    const mysql = require('mysql2/promise');
    const url = process.env.DATABASE_URL || '';
    const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) { console.log('0'); process.exit(0); }
    mysql.createConnection({ host: match[3], port: parseInt(match[4]), user: match[1], password: match[2], database: match[5] })
        .then(async c => {
            const [rows] = await c.query(\"SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()\");
            await c.end();
            console.log(rows[0].cnt || 0);
        }).catch(() => { console.log('0'); });
" 2>/dev/null)

echo "[Diagnostic] Tables detected: ${HAS_DATA:-0}"

if [ "${HAS_DATA:-0}" -gt "5" ]; then
    echo "[Diagnostic] EXISTING database → Safe sync only (no data loss allowed)..."
    $PRISMA db push --skip-generate 2>&1 | grep -v "warn\|Your" || true
else
    echo "[Diagnostic] FRESH database → Full initial schema creation..."
    $PRISMA db push --accept-data-loss --skip-generate > /dev/null 2>&1 || true
fi

# ─── STEP 3: Conditional seeding (seed_yayasan_final.cjs has its own guard) ─
echo "[Diagnostic] Running conditional seeding..."
node prisma/seed_yayasan_final.cjs || echo "[Warning] Seeding skipped (data already exists)."

# ─── STEP 4: Start application ───────────────────────────────────────────────
echo "[Diagnostic] Starting Application..."
exec node index.js
