// SIKAK Yayasan Umum - Unified Server (Version 1.0.3 deployed at 2026-04-06 12:05)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Immediate Boot Log
console.log(`[Diagnostic] ${new Date().toISOString()} - SIKAK Backend Process Starting...`);

// 2. Global Exception Catching (Crucial for Alpine/Docker)
process.on('uncaughtException', (err) => {
    console.error(`[CRITICAL] Uncaught Exception: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[CRITICAL] Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// 3. Early Health Check (Before anything else)

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Lazy Prisma Initialization
let prisma;
let lastSyncError = null;

const getPrisma = () => {
    if (!prisma) {
        prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
    }
    return prisma;
};

const PORT = process.env.PORT || 3000;

// Verbose Diagnostic Log
const rawDBUrl = process.env.DATABASE_URL || '';
const maskedDBUrl = rawDBUrl.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[Diagnostic] PORT: ${PORT}`);
console.log(`[Diagnostic] DATABASE_URL: ${maskedDBUrl}`);
console.log(`[Diagnostic] __dirname: ${__dirname}`);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Real-time Request Logger
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Set prisma instance on app for routers to use
app.set('prisma', getPrisma());

// 4. API Routes
import anggaranRouter from './routes/anggaran.js';
import coreRouter from './routes/core.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sikak-yayasan-umum-secret-2026';

// --- LOGIN ENDPOINT ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const client = getPrisma();

        const user = await client.user.findFirst({
            where: { username, isDeleted: false }
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'Username atau password salah' });
        }

        // Check if password is hashed (bcrypt hashes start with $2)
        let passwordMatch = false;
        if (user.password.startsWith('$2')) {
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // Plain text fallback (for initial superadmin)
            passwordMatch = (user.password === password);
        }

        if (!passwordMatch) {
            return res.status(401).json({ success: false, error: 'Username atau password salah' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            data: {
                token,
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                unitId: user.unitId || null,
                fieldId: user.fieldId || null
            }
        });
    } catch (error) {
        console.error(`[Login Error] ${error.message}`);
        res.status(500).json({ success: false, error: 'Gagal memproses login' });
    }
});

app.use('/api', anggaranRouter);
app.use('/api', coreRouter);

// Global for debugging sync
let lastSyncStats = null;

// --- BULK SYNC ENDPOINT ---
app.post('/api/sync', async (req, res) => {
    try {
        const client = getPrisma();
        lastSyncError = null;
        
        const { 
            fields, units, users, academicYears, positions, 
            studentStatuses, parentStatuses, incomeItems, 
            classes, students, expenseItems, distributionSettings,
            isPurge = false
        } = req.body;

        lastSyncStats = {
            timestamp: new Date().toISOString(),
            studentsCount: students?.length || 0,
            classesCount: classes?.length || 0,
            payloadSize: JSON.stringify(req.body || {}).length
        };
        
        console.log(`[Sync] Starting sync 1.4.3${isPurge ? ' (PURGE MODE)' : ''}. Payload: ${lastSyncStats.payloadSize} bytes`);
        
        await client.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
            
            try {
                if (isPurge) {
                    console.log('[Sync] Purging existing data...');
                    const tablesToPurge = ['StudentIncomeDetail', 'Student', 'Class', 'AcademicYear', 'StudentStatus', 'ParentStatus', 'Position', 'DistributionSetting', 'ExpenseItem', 'IncomeItem'];
                    for (const table of tablesToPurge) {
                        try {
                            await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
                        } catch (te) {
                            console.warn(`[Sync Warn] Could not truncate ${table}: ${te.message}`);
                            // Fallback to deleteMany if truncate fails due to FK
                            await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``);
                        }
                    }
                }
                // 1. Fields
                if (fields && Array.isArray(fields)) {
                    for (const f of fields) {
                        await tx.field.upsert({
                            where: { id: f.id },
                            update: { name: f.name, isDeleted: f.isDeleted || false },
                            create: { id: f.id, name: f.name, isDeleted: f.isDeleted || false }
                        });
                    }
                }

                // 2. Units
                if (units && Array.isArray(units)) {
                    for (const u of units) {
                        await tx.unit.upsert({
                            where: { id: u.id },
                            update: { name: u.name, fieldId: u.fieldId, isDeleted: u.isDeleted || false },
                            create: { id: u.id, name: u.name, fieldId: u.fieldId, isDeleted: u.isDeleted || false }
                        });
                    }
                }

                // 3. Users
                if (users && Array.isArray(users)) {
                    for (const u of users) {
                        await tx.user.upsert({
                            where: { id: u.id },
                            update: { name: u.name, username: u.username, password: u.password, role: u.role, unitId: u.unitId, fieldId: u.fieldId, isDeleted: u.isDeleted || false },
                            create: { id: u.id, name: u.name, username: u.username, password: u.password, role: u.role, unitId: u.unitId, fieldId: u.fieldId, isDeleted: u.isDeleted || false }
                        });
                    }
                }

                // 4. Academic Years
                if (academicYears && Array.isArray(academicYears)) {
                    for (const ay of academicYears) {
                        await tx.academicYear.upsert({
                            where: { id: ay.id },
                            update: { name: ay.name, isCurrent: ay.isCurrent || false, isDeleted: ay.isDeleted || false },
                            create: { id: ay.id, name: ay.name, isCurrent: ay.isCurrent || false, isDeleted: ay.isDeleted || false }
                        });
                    }
                }

                // 5. Classes
                if (classes && Array.isArray(classes)) {
                    for (const c of classes) {
                        await tx.class.upsert({
                            where: { id: c.id },
                            update: { name: c.name, unitId: c.unitId, isDeleted: c.isDeleted || false },
                            create: { id: c.id, name: c.name, unitId: c.unitId, isDeleted: c.isDeleted || false }
                        });
                    }
                }

                // 6. Master Lists (Statuses, Positions, IncomeItems)
                const masters = { position: positions, studentStatus: studentStatuses, parentStatus: parentStatuses, incomeItem: incomeItems };
                for (const [model, list] of Object.entries(masters)) {
                    if (list && Array.isArray(list)) {
                        for (const item of list) {
                            await tx[model].upsert({
                                where: { id: item.id },
                                update: { name: item.name, isDeleted: item.isDeleted || false },
                                create: { id: item.id, name: item.name, isDeleted: item.isDeleted || false }
                            });
                        }
                    }
                }

                // 7. Students (Crucial)
                if (students && Array.isArray(students)) {
                    for (const s of students) {
                        await tx.student.upsert({
                            where: { id: s.id },
                            update: { 
                                nis: s.nis, name: s.name, unitId: s.unitId, 
                                classId: s.classId || null, academicYearId: s.academicYearId || null,
                                statusId: s.statusId || null, parentStatusId: s.parentStatusId || null,
                                isDeleted: s.isDeleted || false 
                            },
                            create: { 
                                id: s.id, nis: s.nis, name: s.name, unitId: s.unitId, 
                                classId: s.classId || null, academicYearId: s.academicYearId || null,
                                statusId: s.statusId || null, parentStatusId: s.parentStatusId || null,
                                isDeleted: s.isDeleted || false 
                            }
                        });

                        if (s.incomeDetails && Array.isArray(s.incomeDetails)) {
                            await tx.studentIncomeDetail.deleteMany({ where: { studentId: s.id } });
                            for (const d of s.incomeDetails) {
                                await tx.studentIncomeDetail.create({
                                    data: { studentId: s.id, incomeItemId: d.incomeItemId, amount: parseFloat(d.amount) || 0 }
                                });
                            }
                        }
                    }
                }

                // 8. Financial (ExpenseItems, Distributions)
                if (expenseItems && Array.isArray(expenseItems)) {
                    for (const e of expenseItems) {
                        await tx.expenseItem.upsert({
                            where: { id: e.id },
                            update: { name: e.name, unitId: e.unitId, fieldId: e.fieldId, accountId: e.accountId, isDeleted: e.isDeleted || false },
                            create: { id: e.id, name: e.name, unitId: e.unitId, fieldId: e.fieldId, accountId: e.accountId, isDeleted: e.isDeleted || false }
                        });
                    }
                }

                if (distributionSettings && Array.isArray(distributionSettings)) {
                    for (const ds of distributionSettings) {
                        await tx.distributionSetting.upsert({
                            where: { id: ds.id },
                            update: { unitId: ds.unitId, incomeItemId: ds.incomeItemId, expenseItemId: ds.expenseItemId, percentage: ds.percentage, isDeleted: ds.isDeleted || false },
                            create: { id: ds.id, unitId: ds.unitId, incomeItemId: ds.incomeItemId, expenseItemId: ds.expenseItemId, percentage: ds.percentage, isDeleted: ds.isDeleted || false }
                        });
                    }
                }

            } finally {
                // ALWAYS re-enable FK checks
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
            }
        }, { timeout: 60000 });

        res.json({ status: 'ok', message: 'Sync Successful 1.4.1' });
    } catch (error) {
        lastSyncError = error.message;
        console.error(`[Sync Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// --- HEALTH CHECK ENDPOINT ---
app.get('/api/health', async (req, res) => {
    const client = getPrisma();
    let stats = {}, dbContent = {}, tables = [], rawCounts = {}, studentStructure = null, dbError = null;

    try {
        const rawTables = await client.$queryRaw`SHOW TABLES`;
        tables = rawTables.map(t => Object.values(t)[0]);
        
        if (tables.some(t => t.toLowerCase() === 'student')) {
            const tbl = tables.find(t => t.toLowerCase() === 'student');
            studentStructure = await client.$queryRawUnsafe(`DESCRIBE ${tbl}`);
            const rS = await client.$queryRawUnsafe(`SELECT COUNT(*) as c FROM ${tbl}`);
            const rA = await client.$queryRawUnsafe(`SELECT COUNT(*) as c FROM ${tbl} WHERE isDeleted = 0`);
            const rC = await client.$queryRawUnsafe(`SELECT COUNT(*) as c FROM ${tables.find(t => t.toLowerCase() === 'class') || 'Class'} WHERE isDeleted = 0`);
            rawCounts = { students: Number(rA[0].c), totalStudents: Number(rS[0].c), classes: Number(rC[0].c) };
        }

        stats = {
            students: await client.student.count({ where: { isDeleted: false } }),
            classes: await client.class.count({ where: { isDeleted: false } }),
            users: await client.user.count({ where: { isDeleted: false } }),
            units: await client.unit.count({ where: { isDeleted: false } })
        };
        
        const sList = await client.student.findMany({ where: { isDeleted: false }, take: 5, select: { name: true } });
        dbContent = { students: sList.map(s => s.name) };
    } catch (e) {
        dbError = e.message;
    }

    res.json({
        status: 'ok', version: '1.4.3', database: dbError ? 'error' : 'connected',
        dbError, tables, rawCounts, studentStructure, lastSyncError, lastSyncStats,
        dbContent, stats, message: 'SIKAK API 1.4.3 Running'
    });
});

app.get('/api/test-student', async (req, res) => {
    try {
        const client = getPrisma();
        // Insert a dummy student to test write permissions
        const testId = `test-${Date.now()}`;
        
        // Find any unit for the test
        const anyUnit = await client.unit.findFirst();
        if (!anyUnit) return res.status(400).json({ error: 'No units exist. Create a unit first.' });

        const result = await client.student.create({
            data: {
                id: testId,
                name: 'Siswa Percobaan (Test)',
                nis: `T${Date.now()}`,
                unitId: anyUnit.id
            }
        });
        res.json({ status: 'ok', message: 'Test Insert Success!', student: result });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

app.get('/api/seed', async (req, res) => {
    try {
        const { execSync } = await import('child_process');
        const output = execSync('node prisma/seed_yayasan_final.cjs').toString();
        await ensureFundSources();
        res.json({ status: 'ok', message: 'Seed Success', output });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

const buildPath = path.join(__dirname, '../dist');
console.log(`[Diagnostic] Build path: ${buildPath}`);

app.use(express.static(buildPath));

app.get('*', (req, res) => {
    try {
        res.sendFile(path.join(buildPath, 'index.html'));
    } catch (error) {
        res.status(404).send('Frontend build (index.html) not found.');
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[Error] ${new Date().toISOString()} - ${err.message}`);
    
    // Handle Prisma specific errors
    if (err.message.includes('Authentication failed')) {
        return res.status(500).json({ 
            error: 'Database Authentication Failed', 
            details: 'Please check DATABASE_URL credentials in Easypanel Environment Variables.' 
        });
    }
    
    if (err.message.includes('Can not connect to database')) {
        return res.status(500).json({ 
            error: 'Database Connection Failed', 
            details: 'Ensure the database container is running and accessible.' 
        });
    }

    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: err.message 
    });
});

// 5. Auto-Seed Function (Background)
const ensureFundSources = async () => {
    const incomeItemsList = [
        'Gedung', 'Asrama', 'Lokal', 'Perlengkapan', 'Penggajian', 
        'Operasional Bulanan', 'Pengembangan dan Pelatihan', 'Uang Makan', 
        'Seragam', 'Kopiah', 'Paket 1 tahun', 'Kegiatan Kesiswaan', 
        'Ekskul', 'Uang Ujian', 'Infaq Perpustakaan', 
        'Buku komunikasi & Raport(LKPD)', 
        'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah', 
        'Buku Pelajaran', 'Buku Kontrol Tahfizh', 'Buku Tulis', 
        'Uang Osis', 'Biaya Pramuka', 'Biaya UKS', 'Biaya Berobat', 
        'Biaya Bus', 'Labor IPA', 'Labor Komputer', 'Outing Class', 
        'Komite', 'Biaya Aplikasi', 'Biaya Try Out', 'Biaya Perpisahan', 
        'Perawatan Sarpras dan Bangunan', 'Biaya Kompre', 'Sosial'
    ];

    try {
        const client = getPrisma();
        console.log(`[Seed] Checking Fund Sources (${incomeItemsList.length} items)...`);
        for (const name of incomeItemsList) {
            const existing = await client.incomeItem.findFirst({
                where: { name, isDeleted: false }
            });
            
            if (!existing) {
                await client.incomeItem.create({
                    data: { name }
                });
                console.log(`[Seed] Added: ${name}`);
            }
        }
        console.log(`[Seed] Fund Source check complete.`);
    } catch (error) {
        console.error(`[Seed Error] ${error.message}`);
    }
};

// Server Listening with Robust Error Handling
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Success] SIKAK Yayasan Backend listening on port ${PORT}`);
    console.log(`[Success] Internal Health Check Path: /health`);
    
    // Trigger background seeding WITHOUT blocking startup
    ensureFundSources().catch(err => {
        console.error(`[Background Seed Error] ${err.message}`);
    });
});

server.on('error', (err) => {
    console.error(`[Error] Server failed to start: ${err.message}`);
    process.exit(1);
});
