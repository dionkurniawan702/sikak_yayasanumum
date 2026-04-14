// SIKAK Yayasan Umum - Unified Server (Version 1.0.3 deployed at 2026-04-06 12:05)
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

// API Routes
import anggaranRouter from './routes/anggaran.js';
import coreRouter from './routes/core.js';
import trashRouter from './routes/trash.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
app.use(compression());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- GLOBAL REQUEST LOGGER ---
app.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
});

// 3. Early Health Check (Before anything else)

app.get('/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbError = null;
    try {
        const client = getPrisma();
        await client.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
    } catch (e) {
        dbError = e.message;
        console.error(`[Health Check Error] Database: ${e.message}`);
    }

    res.status(dbStatus === 'connected' ? 200 : 500).json({ 
        status: dbStatus === 'connected' ? 'ok' : 'error',
        database: dbStatus,
        dbError: dbError,
        timestamp: new Date().toISOString(),
        version: '1.4.4-diag'
    });
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

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Verbose Diagnostic Log
const rawDBUrl = process.env.DATABASE_URL || '';
const maskedDBUrl = rawDBUrl.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[Diagnostic] PORT: ${PORT}`);
console.log(`[Diagnostic] DATABASE_URL: ${maskedDBUrl}`);
console.log(`[Diagnostic] __dirname: ${__dirname}`);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
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
app.use('/api/trash', trashRouter);

// Global for debugging sync
let lastSyncStats = null;

// --- BULK SYNC ENDPOINT ---
app.post('/api/sync', async (req, res) => {
    try {
        const client = getPrisma();
        lastSyncError = null;

        const {
            accounts, journals, assets, programs, expensePrograms, users, budgets,
            fields, units, students, incomeItems, expenseItems, distributionSettings,
            academicYears, classGroups, positions, studentStatuses, parentStatuses,
            budgetRequests, budgetReports, classes, rabPlans,
            bosStages, bosPosList,
            isPurge = false
        } = req.body;

        lastSyncStats = {
            timestamp: new Date().toISOString(),
            studentsCount: students?.length || 0,
            classesCount: classes?.length || 0,
            payloadSize: JSON.stringify(req.body || {}).length
        };

        console.log(`[Sync] Starting sync 1.4.5${isPurge ? ' (PURGE MODE)' : ''}. Payload: ${lastSyncStats.payloadSize} bytes`);

        await client.$transaction(async (tx) => {
            try {
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

                if (isPurge) {
                    console.log('[Sync] Purging existing database tables...');
                    const tablesToPurge = [
                        'StudentIncomeDetail', 'Student', 'Class', 'AcademicYear',
                        'StudentStatus', 'ParentStatus', 'positions', 'distribution_settings',
                        'expense_items', 'income_items', 'class_groups', 'bos_stages', 'bos_pos',
                        'accounts', 'journals', 'assets', 'programs', 'expense_programs', 'budget_allocations',
                        'budget_requests', 'budget_reports', 'rab_plans', 'users'
                    ];
                    for (const table of tablesToPurge) {
                        try {
                            await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``);
                        } catch (te) {
                            console.warn(`[Sync Warn] Could not purge ${table}: ${te.message}`);
                        }
                    }
                }

                const batchUpsert = async (model, data) => {
                    if (!data || !Array.isArray(data) || data.length === 0) return;

                    if (isPurge) {
                        const cleanData = data.map(item => {
                            let clean = {
                                ...item,
                                isDeleted: !!item.isDeleted
                            };
                            if (model === 'program') {
                                const name = (item.name || '').toLowerCase();
                                const isExpense = name.includes('ekskul') || name.includes('konsumsi') ||
                                    name.includes('rapat') || name.includes('operasional') ||
                                    name.includes('belanja');
                                // Force 'Expense' if name matches, otherwise use incoming type or default
                                clean.type = isExpense ? 'Expense' : (item.type || 'Donation');
                            }
                            if (model === 'bosPos') return { id: item.id, name: item.name, isDeleted: !!item.isDeleted };
                            if (model === 'bosStage') return { id: item.id, name: item.name, academicYearId: item.academicYearId || null, isDeleted: !!item.isDeleted };
                            return clean;
                        });
                        await tx[model].createMany({ data: cleanData, skipDuplicates: true });
                    } else {
                        for (const item of data) {
                            let cleanItem = {
                                ...item,
                                isDeleted: !!item.isDeleted
                            };
                            if (model === 'program') {
                                const name = (item.name || '').toLowerCase();
                                const isExpense = name.includes('ekskul') || name.includes('konsumsi') ||
                                    name.includes('rapat') || name.includes('operasional') ||
                                    name.includes('belanja');
                                cleanItem.type = isExpense ? 'Expense' : (item.type || 'Donation');

                                // Fix Prisma Float mapping
                                cleanItem.targetAmount = cleanItem.targetAmount ? parseFloat(cleanItem.targetAmount) : null;

                                // REMOVE non-schema fields (used only in frontend/accounts)
                                delete cleanItem.initialDonationBalance;
                                delete cleanItem.initialResultBalance;
                            }
                            if (model === 'distributionSetting') {
                                cleanItem.percentage = cleanItem.percentage ? parseFloat(cleanItem.percentage) : 0;
                            }
                            if (model === 'field') {
                                delete cleanItem.fieldId;
                            }
                            if (model === 'academicYear') {
                                delete cleanItem.startDate;
                                delete cleanItem.endDate;
                            }
                            if (model === 'classGroup') {
                                delete cleanItem.unitId;
                            }
                            if (model === 'account') {
                                if (cleanItem.initialBalance !== undefined) {
                                    cleanItem.balance = parseFloat(cleanItem.initialBalance) || 0;
                                }
                                delete cleanItem.initialBalance;
                                delete cleanItem.normalBalance;
                            }
                            await tx[model].upsert({
                                where: { id: item.id },
                                update: { ...cleanItem, id: undefined },
                                create: { ...cleanItem }
                            });
                        }
                    }
                };

                await batchUpsert('field', fields);
                await batchUpsert('unit', units);
                await batchUpsert('user', users);
                await batchUpsert('academicYear', academicYears);
                await batchUpsert('classGroup', classGroups);
                await batchUpsert('account', accounts);

                if (journals && Array.isArray(journals)) {
                    for (const j of journals) {
                        try {
                            const entriesJson = typeof j.entries === 'string' ? JSON.parse(j.entries) : j.entries;
                            await tx.journal.upsert({
                                where: { id: j.id },
                                update: { ...j, entries: entriesJson, id: undefined },
                                create: { ...j, entries: entriesJson }
                            });
                        } catch (je) {
                            console.error(`[Sync Fail] Journal ${j.id}: ${je.message}`);
                        }
                    }
                }

                await batchUpsert('asset', assets);
                await batchUpsert('program', programs);
                await batchUpsert('expenseProgram', expensePrograms);

                if (classes && Array.isArray(classes)) {
                    for (const c of classes) {
                        try {
                            await tx.class.upsert({
                                where: { id: c.id },
                                update: { name: c.name, unitId: c.unitId, isDeleted: !!c.isDeleted },
                                create: { id: c.id, name: c.name, unitId: c.unitId, isDeleted: !!c.isDeleted }
                            });
                        } catch (ce) {
                            console.error(`[Sync Fail] Class ${c.id}: ${ce.message}`);
                        }
                    }
                }

                await batchUpsert('position', positions);
                await batchUpsert('studentStatus', studentStatuses);
                await batchUpsert('parentStatus', parentStatuses);
                await batchUpsert('incomeItem', incomeItems);
                await batchUpsert('expenseItem', expenseItems);

                if (students && Array.isArray(students)) {
                    for (const s of students) {
                        try {
                            await tx.student.upsert({
                                where: { id: s.id },
                                update: {
                                    nis: s.nis, name: s.name, unitId: s.unitId,
                                    classId: s.classId || null, academicYearId: s.academicYearId || null,
                                    statusId: s.statusId || null, parentStatusId: s.parentStatusId || null,
                                    isDeleted: !!s.isDeleted
                                },
                                create: {
                                    id: s.id, nis: s.nis, name: s.name, unitId: s.unitId,
                                    classId: s.classId || null, academicYearId: s.academicYearId || null,
                                    statusId: s.statusId || null, parentStatusId: s.parentStatusId || null,
                                    isDeleted: !!s.isDeleted
                                }
                            });

                            if (s.incomeDetails && Array.isArray(s.incomeDetails) && s.incomeDetails.length > 0) {
                                await tx.studentIncomeDetail.deleteMany({ where: { studentId: s.id } });
                                await tx.studentIncomeDetail.createMany({
                                    data: s.incomeDetails.map(d => ({
                                        studentId: s.id,
                                        incomeItemId: d.incomeItemId,
                                        amount: parseFloat(d.amount) || 0
                                    }))
                                });
                            }
                        } catch (se) {
                            console.error(`[Sync Fail] Student ${s.id}: ${se.message}`);
                        }
                    }
                }

                await batchUpsert('distributionSetting', distributionSettings);
                await batchUpsert('rabPlan', rabPlans);
                await batchUpsert('bosStage', bosStages);
                await batchUpsert('bosPos', bosPosList);

                await batchUpsert('budgetAllocation', budgets);
                await batchUpsert('budgetRequest', budgetRequests);
                await batchUpsert('budgetReport', budgetReports);

            } finally {
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
            }
        }, { timeout: 120000 });

        res.json({ status: 'ok', message: 'Sync Successful 1.4.7' });
    } catch (error) {
        lastSyncError = error.message;
        console.error(`[Sync Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// --- ALL DATA ENDPOINT ---
app.get('/api/all-data', async (req, res) => {
    try {
        const client = getPrisma();
        const [
            accounts, journals, assets, programs, expensePrograms, users, budgets,
            fields, units, students, incomeItems, expenseItems, distributionSettings,
            academicYears, classGroups, positions, studentStatuses, parentStatuses,
            budgetRequests, budgetReports, classes, rabPlans, bosStages, bosPosList
        ] = await Promise.all([
            client.account.findMany({ orderBy: { code: 'asc' } }),
            client.journal.findMany({ orderBy: { date: 'desc' }, take: 500 }),
            client.asset.findMany(),
            client.program.findMany(),
            client.expenseProgram.findMany(),
            client.user.findMany(),
            client.budgetAllocation.findMany(),
            client.field.findMany(),
            client.unit.findMany(),
            client.student.findMany({ include: { incomeDetails: true } }),
            client.incomeItem.findMany(),
            client.expenseItem.findMany(),
            client.distributionSetting.findMany(),
            client.academicYear.findMany(),
            client.classGroup.findMany(),
            client.position.findMany(),
            client.studentStatus.findMany(),
            client.parentStatus.findMany(),
            client.budgetRequest.findMany(),
            client.budgetReport.findMany(),
            client.class.findMany(),
            client.rabPlan.findMany(),
            client.bosStage.findMany(),
            client.bosPos.findMany()
        ]);

        res.json({
            status: 'ok',
            data: {
                accounts, journals, assets, programs, expensePrograms, users, budgets,
                fields, units, students, incomeItems, expenseItems, distributionSettings,
                academicYears, classGroups, positions, studentStatuses, parentStatuses,
                budgetRequests, budgetReports, classes, rabPlans, bosStages, bosPosList
            }
        });
    } catch (error) {
        console.error(`[All Data Error] ${error.message}`);
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
            units: await client.unit.count({ where: { isDeleted: false } }),
            rabPlans: await client.rabPlan.count()
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

        // Find references for the test
        const anyUnit = await client.unit.findFirst();
        if (!anyUnit) return res.status(400).json({ error: 'No units exist. Create a unit first.' });

        const currentYear = await client.academicYear.findFirst({ where: { isCurrent: true, isDeleted: false } });
        const activeStatus = await client.studentStatus.findFirst({ where: { name: 'Aktif', isDeleted: false } });

        const result = await client.student.create({
            data: {
                id: testId,
                name: 'Siswa Percobaan (Test)',
                nis: `T${Date.now()}`,
                unitId: anyUnit.id,
                academicYearId: currentYear?.id || null,
                statusId: activeStatus?.id || null
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
    console.error(`[Global Error Handler] ${new Date().toISOString()} - ${err.message}`);

    // Robust identification of connection issues
    const isConnError = 
        err.message.includes('Can not connect to database') || 
        err.message.includes('reach database server') ||
        err.message.includes('ECONNREFUSED');
    
    if (err.message.includes('Authentication failed')) {
        return res.status(500).json({
            error: 'Database Authentication Failed',
            message: 'Kredensial database tidak valid. Periksa DATABASE_URL di Environment Variables.',
            details: err.message
        });
    }

    if (isConnError) {
        return res.status(500).json({
            error: 'Database Connection Failed',
            message: 'Server tidak bisa terhubung ke database. Pastikan kontainer database sedang berjalan.',
            details: err.message,
            host_attempted: process.env.DATABASE_URL?.split('@')[1]
        });
    }

    res.status(500).json({
        error: 'Sistem Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 5. Auto-Seed Function (Background)
const ensureDistributionColumns = async () => {
    try {
        const client = getPrisma();
        console.log(`[Self-Healing] Checking distribution_settings for destType/destId columns...`);
        
        const tableNames = ['distribution_settings', 'DistributionSetting'];
        let targetTable = null;

        for (const name of tableNames) {
            try {
                await client.$queryRawUnsafe(`DESCRIBE \`${name}\``);
                targetTable = name;
                break;
            } catch (e) {}
        }

        if (targetTable) {
            const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
            const hasDestType = columns.some(c => c.Field === 'destType' || c.field === 'destType');
            const hasDestId = columns.some(c => c.Field === 'destId' || c.field === 'destId');

            if (!hasDestType) {
                console.log(`[Self-Healing] Adding destType to ${targetTable}...`);
                await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN destType VARCHAR(50) DEFAULT 'unit'`);
            }
            if (!hasDestId) {
                console.log(`[Self-Healing] Adding destId to ${targetTable}...`);
                await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN destId VARCHAR(255)`);
            }
        }
    } catch (error) {
        console.error(`[Self-Healing Error] Distribution columns: ${error.message}`);
    }
};

const ensureSoftDeleteColumns = async () => {
    const models = [
        { name: 'AcademicYear', table: 'AcademicYear' },
        { name: 'BosStage', table: 'bos_stages' },
        { name: 'BosPos', table: 'bos_pos' },
        { name: 'Class', table: 'Class' },
        { name: 'Student', table: 'Student' },
        { name: 'StudentStatus', table: 'StudentStatus' },
        { name: 'ParentStatus', table: 'ParentStatus' },
        { name: 'Position', table: 'positions' },
        { name: 'ClassGroup', table: 'class_groups' },
        { name: 'Unit', table: 'units' },
        { name: 'Field', table: 'fields' },
        { name: 'Account', table: 'accounts' },
        { name: 'Asset', table: 'assets' },
        { name: 'Program', table: 'programs' },
        { name: 'ExpenseProgram', table: 'expense_programs' },
        { name: 'IncomeItem', table: 'income_items' },
        { name: 'ExpenseItem', table: 'expense_items' },
        { name: 'Journal', table: 'journals' }
    ];

    try {
        const client = getPrisma();
        console.log(`[Self-Healing] Checking ${models.length} tables for isDeleted column...`);
        for (const m of models) {
            const tableVariations = [
                m.table,
                m.name,
                m.name.charAt(0).toUpperCase() + m.name.slice(1),
                m.name.toLowerCase()
            ].filter((v, i, a) => v && a.indexOf(v) === i); // deduplicate

            let success = false;
            for (const tableName of tableVariations) {
                try {
                    const columns = await client.$queryRawUnsafe(`DESCRIBE \`${tableName}\``);
                    const hasIsDeleted = columns.some(c => c.Field === 'isDeleted' || c.field === 'isDeleted');

                    if (!hasIsDeleted) {
                        console.log(`[Self-Healing] Adding isDeleted to ${tableName}...`);
                        await client.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE`);
                    }
                    success = true;
                    break;
                } catch (e) {
                    // Try next variation
                }
            }
            if (!success) {
                console.warn(`[Self-Healing Warn] Could not find/fix table for model ${m.name}`);
            }
        }
        console.log(`[Self-Healing] Database check complete.`);
    } catch (error) {
        console.error(`[Self-Healing Error] ${error.message}`);
    }
};

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
    console.log(`\n\n************************************************`);
    console.log(`[SUCCESS] SIKAK Yayasan Backend is now ACTIVE!`);
    console.log(`[Diagnostic] Port: ${PORT}`);
    console.log(`[Diagnostic] Time: ${new Date().toISOString()}`);
    console.log(`[Diagnostic] Health Check: http://0.0.0.0:${PORT}/health`);
    console.log(`************************************************\n\n`);

    // Trigger background seeding & healing WITHOUT blocking startup
    const startBackgroundTasks = async () => {
        try {
            await ensureSoftDeleteColumns();
            await ensureFundSources();
            await ensureDistributionColumns();
        } catch (err) {
            console.error(`[Background Tasks Error] ${err.message}`);
        }
    };
    
    startBackgroundTasks();
});

server.on('error', (err) => {
    console.error(`[Error] Server failed to start: ${err.message}`);
    process.exit(1);
});
