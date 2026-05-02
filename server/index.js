// SIKAD Dareliman - Unified Server (Version 1.0.3 deployed at 2026-04-06 12:05)
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
console.log(`[Diagnostic] ${new Date().toISOString()} - SIKAD Backend Process Starting...`);

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
        version: '1.5.9'
    });
});

app.get('/api/check-db', async (req, res) => {
    try {
        const client = getPrisma();
        const rawTables = await client.$queryRaw`SHOW TABLES`;
        const tables = rawTables.map(t => Object.values(t)[0]);
        const targetTable = tables.find(t => t.toLowerCase() === 'academicyear' || t.toLowerCase() === 'academic_year');

        if (!targetTable) return res.status(404).json({ status: 'error', message: 'AcademicYear table not found' });

        const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
        const data = await client.academicYear.findMany({
            take: 10,
            where: { isDeleted: false },
            orderBy: { name: 'asc' }
        });

        res.json({
            status: 'ok',
            table: targetTable,
            columns,
            data,
            version: '1.5.9',
            serverTime: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Lazy Prisma Initialization
let prisma;
let lastSyncError = null;

const getPrisma = () => {
    if (!prisma) {
        prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
        
        // --- AUTO CLEANUP LOGIC ---
        setTimeout(async () => {
            console.log('[Cleanup] Initiating RabPlan duplicates cleanup...');
            try {
                const allPlans = await prisma.rabPlan.findMany();
                let deletedCount = 0;
                let ghostCount = 0;

                // 1. Purge Ghost Records (Incomplete IDs)
                const ghosts = allPlans.filter(p => !p.id.endsWith('-YAYASAN') && !p.id.endsWith('-BOS'));
                for (const g of ghosts) {
                    await prisma.rabPlan.delete({ where: { id: g.id } });
                    ghostCount++;
                }

                // 2. Cleanup Duplicates
                const groups = {};
                const plansAfterGhostPurge = allPlans.filter(p => p.id.endsWith('-YAYASAN') || p.id.endsWith('-BOS'));
                plansAfterGhostPurge.forEach(p => {
                    const isBos = p.id.endsWith('-BOS');
                    const source = isBos ? 'BOS' : 'YAYASAN';
                    const key = `${p.academicYearId}|${p.unitId || 'FIELD-' + p.fieldId}|${source}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(p);
                });

                for (const key in groups) {
                    const list = groups[key];
                    if (list.length > 1) {
                        list.sort((a, b) => {
                            if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
                            if (b.status === 'APPROVED' && a.status !== 'APPROVED') return 1;
                            return new Date(b.updatedAt) - new Date(a.updatedAt);
                        });
                        const toDelete = list.slice(1);
                        for (const target of toDelete) {
                            await prisma.rabPlan.delete({ where: { id: target.id } });
                            deletedCount++;
                        }
                    }
                }
                // 3. Purge Empty Drafts (Older than 1 hour to avoid deleting active sessions)
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                const emptyDrafts = allPlans.filter(p => {
                    if (p.status !== 'DRAFT') return false;
                    if (new Date(p.updatedAt) > oneHourAgo) return false;

                    const isEmpty = (obj) => {
                        if (!obj) return true;
                        let parsed = obj;
                        if (typeof obj === 'string') {
                            try { parsed = JSON.parse(obj); } catch (e) { return true; }
                        }
                        if (Object.keys(parsed).length === 0) return true;
                        return Object.values(parsed).every(arr => Array.isArray(arr) && arr.length === 0);
                    };
                    return isEmpty(p.income) && isEmpty(p.expense);
                });

                for (const ed of emptyDrafts) {
                    await prisma.rabPlan.delete({ where: { id: ed.id } });
                    deletedCount++;
                }

                if (deletedCount > 0 || ghostCount > 0) {
                    console.log(`[Cleanup] Finished. Deleted ${deletedCount} records (duplicates/empty) and ${ghostCount} ghost records.`);
                }
            } catch (err) {
                console.error('[Cleanup Error]', err.message);
            }
        }, 5000); // Wait 5s after startup to not block boot
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

const JWT_SECRET = process.env.JWT_SECRET || 'sikad-dareliman-secret-2026';

// --- LOGIN ENDPOINT ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const client = getPrisma();

        console.log(`[Login Attempt] Username: ${username}`);
        const user = await client.user.findFirst({
            where: { username, isDeleted: false }
        });

        if (!user) {
            console.log(`[Login Failure] User "${username}" NOT found in database.`);
            return res.status(401).json({ success: false, error: 'Username atau password salah' });
        }

        console.log(`[Login Progress] User "${username}" found. Checking password...`);

        // Check if password is hashed (bcrypt hashes start with $2)
        let passwordMatch = false;
        if (user.password.startsWith('$2')) {
            console.log(`[Login Progress] Hashed password detected. comparing...`);
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            console.log(`[Login Progress] Plaintext password detected. Comparing...`);
            passwordMatch = (user.password === password);
        }

        if (!passwordMatch) {
            console.log(`[Login Failure] Password for "${username}" does NOT match.`);
            return res.status(401).json({ success: false, error: 'Username atau password salah' });
        }

        console.log(`[Login Success] User "${username}" authenticated successfully.`);

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
        const {
            accounts, journals, assets, programs, expensePrograms, users, budgets,
            fields, units, students, incomeItems, expenseItems, distributionSettings,
            academicYears, classGroups, positions, studentStatuses, parentStatuses,
            budgetRequests, budgetReports, classes, rabPlans,
            bosStages, bosPosList, bosAllocations,
            isPurge = false
        } = req.body;

        lastSyncStats = {
            timestamp: new Date().toISOString(),
            studentsCount: students?.length || 0,
            classesCount: classes?.length || 0,
            payloadSize: JSON.stringify(req.body || {}).length
        };

        const results = {
            core: { status: 'pending' },
            finance: { status: 'pending' },
            budget: { status: 'pending' },
            students: { status: 'pending' }
        };

        const batchUpsert = async (tx, model, data) => {
            if (!data || !Array.isArray(data) || data.length === 0) return;

            for (const item of data) {
                try {
                    let cleanItem = { ...item, isDeleted: !!item.isDeleted };

                    // Model-specific cleaning
                    if (model === 'program') {
                        const name = (item.name || '').toLowerCase();
                        const isExpense = name.includes('ekskul') || name.includes('konsumsi') ||
                            name.includes('rapat') || name.includes('operasional') ||
                            name.includes('belanja');
                        cleanItem.type = isExpense ? 'Expense' : (item.type || 'Donation');
                        cleanItem.targetAmount = cleanItem.targetAmount ? parseFloat(cleanItem.targetAmount) : null;
                        delete cleanItem.initialDonationBalance;
                        delete cleanItem.initialResultBalance;
                    }
                    if (model === 'distributionSetting') {
                        cleanItem.percentage = cleanItem.percentage ? parseFloat(cleanItem.percentage) : 0;
                        cleanItem.destType = cleanItem.destType || 'unit';
                        cleanItem.destId = cleanItem.destId || null;
                    }
                    if (model === 'field') delete cleanItem.fieldId;
                    if (model === 'academicYear') {
                        // Anti-Wipe: Only update dates if they are NOT null in the incoming payload
                        // This prevents old/stale sync data from clearing valid dates
                        if (!cleanItem.startDate) delete cleanItem.startDate;
                        else cleanItem.startDate = new Date(cleanItem.startDate);

                        if (!cleanItem.endDate) delete cleanItem.endDate;
                        else cleanItem.endDate = new Date(cleanItem.endDate);

                        try {
                            const existing = await tx.academicYear.findFirst({
                                where: { OR: [{ id: cleanItem.id }, { name: cleanItem.name }] }
                            });

                            if (existing) {
                                // DOUBLE PROTECT: Never allow NULL to overwrite an existing date on the server
                                const finalUpdate = { ...cleanItem, id: undefined };

                                // Explicit check: If incoming is null/undefined but server HAS data, keep server data
                                if (!cleanItem.name) delete finalUpdate.name; // Don't wipe name
                                if (!cleanItem.startDate && existing.startDate) delete finalUpdate.startDate;
                                if (!cleanItem.endDate && existing.endDate) delete finalUpdate.endDate;

                                await tx.academicYear.update({
                                    where: { id: existing.id },
                                    data: finalUpdate
                                });
                                continue;
                            }
                        } catch (e) {
                            console.error(`[Sync Fix Error] ${e.message}`);
                        }
                    }
                    if (model === 'classGroup') delete cleanItem.unitId;
                    if (model === 'account') {
                        if (cleanItem.initialBalance !== undefined) cleanItem.balance = parseFloat(cleanItem.initialBalance) || 0;
                        delete cleanItem.initialBalance; delete cleanItem.normalBalance;
                    }
                    if (model === 'budgetRequest') {
                        if (cleanItem.date) cleanItem.date = new Date(cleanItem.date);
                        if (cleanItem.totalAmount !== undefined && cleanItem.totalAmount !== null) cleanItem.totalAmount = parseFloat(cleanItem.totalAmount);
                        if (cleanItem.amount !== undefined && cleanItem.amount !== null) cleanItem.amount = parseFloat(cleanItem.amount);
                        if (cleanItem.reports) delete cleanItem.reports;
                    }
                    if (model === 'budgetReport') {
                        if (cleanItem.date) cleanItem.date = new Date(cleanItem.date);
                        if (cleanItem.amount !== undefined && cleanItem.amount !== null) cleanItem.amount = parseFloat(cleanItem.amount);
                        if (cleanItem.budgetRequest) delete cleanItem.budgetRequest;
                    }

                    await tx[model].upsert({
                        where: { id: item.id },
                        update: { ...cleanItem, id: undefined },
                        create: { ...cleanItem }
                    });
                } catch (e) {
                    console.error(`[Sync Item Fail] ${model} ${item.id}: ${e.message}`);
                    // Continue with other items in the batch
                }
            }
        };

        // 1. Core Data (Fields, Units, Users, Years)
        try {
            await client.$transaction(async (tx) => {
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
                if (isPurge) {
                    await tx.$executeRawUnsafe('DELETE FROM `fields`');
                    await tx.$executeRawUnsafe('DELETE FROM `units`');
                    await tx.$executeRawUnsafe('DELETE FROM `users`');
                }
                await batchUpsert(tx, 'field', fields);
                await batchUpsert(tx, 'unit', units);
                await batchUpsert(tx, 'user', users);
                await batchUpsert(tx, 'academicYear', academicYears);
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
            });
            results.core.status = 'success';
        } catch (e) {
            results.core.status = 'error';
            results.core.message = e.message;
            console.error(`[Sync Group Fail] Core: ${e.message}`);
        }

        // 2. Finance Data (Accounts, Journals, Assets, Programs)
        try {
            await client.$transaction(async (tx) => {
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
                if (isPurge) {
                    await tx.$executeRawUnsafe('DELETE FROM `accounts`');
                    await tx.$executeRawUnsafe('DELETE FROM `journals`');
                    await tx.$executeRawUnsafe('DELETE FROM `assets`');
                    await tx.$executeRawUnsafe('DELETE FROM `programs`');
                    await tx.$executeRawUnsafe('DELETE FROM `expense_programs`');
                }
                await batchUpsert(tx, 'account', accounts);
                await batchUpsert(tx, 'journal', journals);
                await batchUpsert(tx, 'asset', assets);
                await batchUpsert(tx, 'program', programs);
                await batchUpsert(tx, 'expenseProgram', expensePrograms);
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
            });
            results.finance.status = 'success';
        } catch (e) {
            results.finance.status = 'error';
            results.finance.message = e.message;
            console.error(`[Sync Group Fail] Finance: ${e.message}`);
        }

        // 3. Budget Data (RAB, BOS, Allocations)
        try {
            await client.$transaction(async (tx) => {
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
                if (isPurge) {
                    await tx.$executeRawUnsafe('DELETE FROM `distribution_settings`');
                    await tx.$executeRawUnsafe('DELETE FROM `rab_plans`');
                    await tx.$executeRawUnsafe('DELETE FROM `bos_stages`');
                    await tx.$executeRawUnsafe('DELETE FROM `bos_pos`');
                    await tx.$executeRawUnsafe('DELETE FROM `budget_allocations`');
                }
                await batchUpsert(tx, 'distributionSetting', distributionSettings);
                await batchUpsert(tx, 'rabPlan', rabPlans);
                await batchUpsert(tx, 'bosStage', bosStages);
                await batchUpsert(tx, 'bosPos', bosPosList);
                await batchUpsert(tx, 'bosAllocation', bosAllocations);
                await batchUpsert(tx, 'budgetAllocation', budgets);
                await batchUpsert(tx, 'budgetRequest', budgetRequests);
                await batchUpsert(tx, 'budgetReport', budgetReports);
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
            });
            results.budget.status = 'success';
        } catch (e) {
            results.budget.status = 'error';
            results.budget.message = e.message;
            console.error(`[Sync Group Fail] Budget: ${e.message}`);
        }

        // 4. Student Data (Students, Classes, Groups, Statuses)
        try {
            await client.$transaction(async (tx) => {
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
                if (isPurge) {
                    await tx.$executeRawUnsafe('DELETE FROM `Student`');
                    await tx.$executeRawUnsafe('DELETE FROM `Class`');
                    await tx.$executeRawUnsafe('DELETE FROM `class_groups`');
                }

                await batchUpsert(tx, 'classGroup', classGroups);
                await batchUpsert(tx, 'position', positions);
                await batchUpsert(tx, 'studentStatus', studentStatuses);
                await batchUpsert(tx, 'parentStatus', parentStatuses);
                await batchUpsert(tx, 'class', classes);

                if (students && Array.isArray(students)) {
                    for (const s of students) {
                        try {
                            await tx.student.upsert({
                                where: { id: s.id },
                                update: {
                                    id: s.id, nis: s.nis, name: s.name, unitId: s.unitId,
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
                await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
            });
            results.students.status = 'success';
        } catch (e) {
            results.students.status = 'error';
            results.students.message = e.message;
            console.error(`[Sync Group Fail] Students: ${e.message}`);
        }

        const overallSuccess = Object.values(results).every(r => r.status === 'success');
        res.json({
            status: overallSuccess ? 'ok' : 'partial',
            message: overallSuccess ? 'Sync Successful' : 'Sync completed with some group errors',
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[Fatal Sync Error] ${error.message}`);
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
            budgetRequests, budgetReports, classes, rabPlans, bosStages, bosPosList, bosAllocations
        ] = await Promise.all([
            client.account.findMany({ where: { isDeleted: false }, orderBy: { code: 'asc' } }),
            client.journal.findMany({ where: { isDeleted: false }, orderBy: { date: 'desc' }, take: 500 }),
            client.asset.findMany({ where: { isDeleted: false } }),
            client.program.findMany({ where: { isDeleted: false } }),
            client.expenseProgram.findMany({ where: { isDeleted: false } }),
            client.user.findMany({ where: { isDeleted: false } }),
            client.budgetAllocation.findMany({ where: { isDeleted: false } }),
            client.field.findMany({ where: { isDeleted: false } }),
            client.unit.findMany({ where: { isDeleted: false } }),
            client.student.findMany({ where: { isDeleted: false }, include: { incomeDetails: true } }),
            client.incomeItem.findMany({ where: { isDeleted: false } }),
            client.expenseItem.findMany({ where: { isDeleted: false } }),
            client.distributionSetting.findMany({ where: { isDeleted: false } }),
            client.academicYear.findMany({ where: { isDeleted: false } }),
            client.classGroup.findMany({ where: { isDeleted: false } }),
            client.position.findMany({ where: { isDeleted: false } }),
            client.studentStatus.findMany({ where: { isDeleted: false } }),
            client.parentStatus.findMany({ where: { isDeleted: false } }),
            client.budgetRequest.findMany({ where: { isDeleted: false } }),
            client.budgetReport.findMany({ where: { isDeleted: false } }),
            client.class.findMany({ where: { isDeleted: false } }),
            client.rabPlan.findMany(),
            client.bosStage.findMany({ where: { isDeleted: false } }),
            client.bosPos.findMany({ where: { isDeleted: false } }),
            client.bosAllocation.findMany()
        ]);

        res.json({
            status: 'ok',
            data: {
                accounts, journals, assets, programs, expensePrograms, users, budgets,
                fields, units, students, incomeItems, expenseItems, distributionSettings,
                academicYears, classGroups, positions, studentStatuses, parentStatuses,
                budgetRequests, budgetReports, classes, rabPlans, bosStages, bosPosList, bosAllocations
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
        dbContent, stats, message: 'SIKAD API 1.4.3 Running'
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
            } catch (e) { }
        }

        if (targetTable) {
            const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
            const hasDestType = columns.some(c => c.Field === 'destType' || c.field === 'destType');
            const hasDestId = columns.some(c => c.Field === 'destId' || c.field === 'destId');
            const hasDestName = columns.some(c => c.Field === 'destName' || c.field === 'destName');

            if (!hasDestType) {
                console.log(`[Self-Healing] Adding destType to ${targetTable}...`);
                await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN destType VARCHAR(50) DEFAULT 'unit'`);
            }
            if (!hasDestId) {
                console.log(`[Self-Healing] Adding destId to ${targetTable}...`);
                await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN destId VARCHAR(255)`);
            }
            if (!hasDestName) {
                console.log(`[Self-Healing] Adding destName to ${targetTable}...`);
                await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN destName VARCHAR(255)`);
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
        { name: 'Journal', table: 'journals' },
        { name: 'AcademicYear', table: 'AcademicYear', columns: ['isActive'] }
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

                    // Specific column checks for certain tables
                    if (m.columns) {
                        for (const colName of m.columns) {
                            const hasCol = columns.some(c => c.Field === colName || c.field === colName);
                            if (!hasCol) {
                                console.log(`[Self-Healing] Adding ${colName} to ${tableName}...`);
                                if (colName === 'isActive') {
                                    await client.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN isActive BOOLEAN DEFAULT TRUE`);
                                }
                            }
                        }
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

const ensureBudgetOperationalColumns = async () => {
    try {
        const client = getPrisma();
        console.log(`[Self-Healing] Checking budget tables for operational columns...`);

        // 1. budget_requests
        const reqCols = await client.$queryRaw`DESCRIBE \`budget_requests\``;
        const reqFields = reqCols.map(c => c.Field || c.field);

        if (!reqFields.includes('unitId')) await client.$executeRawUnsafe('ALTER TABLE `budget_requests` ADD COLUMN unitId VARCHAR(255)');
        if (!reqFields.includes('fieldId')) await client.$executeRawUnsafe('ALTER TABLE `budget_requests` ADD COLUMN fieldId VARCHAR(255)');
        if (!reqFields.includes('academicYearId')) await client.$executeRawUnsafe('ALTER TABLE `budget_requests` ADD COLUMN academicYearId VARCHAR(255)');
        if (!reqFields.includes('totalAmount')) await client.$executeRawUnsafe('ALTER TABLE `budget_requests` ADD COLUMN totalAmount DECIMAL(15, 2)');
        if (!reqFields.includes('items')) await client.$executeRawUnsafe('ALTER TABLE `budget_requests` ADD COLUMN items JSON');

        // Fix month column (might be Int, we want String for flexible month IDs like "2026-07")
        const monthCol = reqCols.find(c => (c.Field === 'month' || c.field === 'month'));
        if (monthCol && (monthCol.Type || monthCol.type).toLowerCase().includes('int')) {
            console.log(`[Self-Healing] Converting budget_requests.month from Int to VarChar...`);
            await client.$executeRawUnsafe('ALTER TABLE `budget_requests` MODIFY COLUMN month VARCHAR(50)');
        }

        // 2. budget_reports
        const repCols = await client.$queryRaw`DESCRIBE \`budget_reports\``;
        const repFields = repCols.map(c => c.Field || c.field);

        if (!repFields.includes('unitId')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN unitId VARCHAR(255)');
        if (!repFields.includes('fieldId')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN fieldId VARCHAR(255)');
        if (!repFields.includes('academicYearId')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN academicYearId VARCHAR(255)');
        if (!repFields.includes('category')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN category VARCHAR(255)');
        // New columns for enhanced laporan form
        if (!repFields.includes('buktiTeks')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN buktiTeks TEXT');
        if (!repFields.includes('nomorNota')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN nomorNota VARCHAR(255)');
        if (!repFields.includes('volume')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN volume DECIMAL(15,4)');
        if (!repFields.includes('satuan')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN satuan VARCHAR(100)');
        if (!repFields.includes('harga')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN harga DECIMAL(15,2)');
        if (!repFields.includes('kategoriAset')) await client.$executeRawUnsafe("ALTER TABLE `budget_reports` ADD COLUMN kategoriAset VARCHAR(50) DEFAULT 'NON_ASET'");
        if (!repFields.includes('umurEkonomis')) await client.$executeRawUnsafe('ALTER TABLE `budget_reports` ADD COLUMN umurEkonomis INT');
        if (!repFields.includes('status')) {
            console.log(`[Self-Healing] Adding status column to budget_reports...`);
            await client.$executeRawUnsafe("ALTER TABLE `budget_reports` ADD COLUMN status VARCHAR(191) DEFAULT 'PENDING'");
        }

        console.log(`[Self-Healing] Budget tables check complete.`);
    } catch (error) {
        console.error(`[Self-Healing Error] Budget columns: ${error.message}`);
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

const ensureAcademicYears = async () => {
    const requiredYears = [
        { id: 'AY-2023-2024', name: '2023-2024', isCurrent: false },
        { id: 'AY-2024-2025', name: '2024-2025', isCurrent: false },
        { id: 'AY-2025-2026', name: '2025-2026', isCurrent: false },
        { id: 'AY-2026-2027', name: '2026-2027', isCurrent: false },
        { id: 'AY-2027-2028', name: '2027-2028', isCurrent: false },
    ];

    try {
        const client = getPrisma();

        // --- SELF-HEALING: Ensure Date Columns Exist ---
        try {
            const tableVariations = ['AcademicYear', 'academicyear', 'academic_year'];
            let targetTable = null;
            for (const t of tableVariations) {
                try {
                    await client.$queryRawUnsafe(`DESCRIBE \`${t}\``);
                    targetTable = t;
                    break;
                } catch (e) { }
            }

            if (targetTable) {
                const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
                const hasCol = (name) => columns.some(c => (c.Field || c.field).toLowerCase() === name.toLowerCase());

                if (!hasCol('startDate')) {
                    console.log(`[Self-Healing] Adding startDate to ${targetTable}...`);
                    await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN startDate DATETIME NULL`);
                }
                if (!hasCol('endDate')) {
                    console.log(`[Self-Healing] Adding endDate to ${targetTable}...`);
                    await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN endDate DATETIME NULL`);
                }
            }
        } catch (colErr) {
            console.error(`[Self-Healing Error] AcademicYear columns: ${colErr.message}`);
        }

        console.log('[Seed] Ensuring academic years exist with standard IDs...');
        for (const y of requiredYears) {
            await client.academicYear.upsert({
                where: { name: y.name },
                update: {},  // don't overwrite user settings
                create: { id: y.id, name: y.name, isCurrent: y.isCurrent, isActive: true }
            });
        }
        console.log('[Seed] Academic years check complete.');
    } catch (error) {
        console.error(`[Seed Error] Academic years: ${error.message}`);
    }
};

const healAcademicYearIds = async () => {
    try {
        const client = getPrisma();
        console.log('[NUCLEAR-FIX] Starting direct database ID re-writing...');

        // 1. Disable Foreign Key Checks to allow Primary Key updates
        await client.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

        try {
            const tableVariations = ['AcademicYear', 'academicyear', 'academic_year'];
            let targetTable = 'AcademicYear'; // fallback
            const rawTables = await client.$queryRaw`SHOW TABLES`;
            const tables = rawTables.map(t => Object.values(t)[0]);
            targetTable = tables.find(t => tableVariations.includes(t)) || 'AcademicYear';

            const years = await client.academicYear.findMany();
            for (const year of years) {
                if (!year.id.startsWith('AY-')) {
                    const standardId = `AY-${year.name.replace(/\//g, '-')}`;
                    const oldId = year.id;

                    console.log(`[NUCLEAR-FIX] Force Rename: ${oldId} -> ${standardId} (${year.name})`);

                    // A. Update Related Tables directly
                    await client.$executeRawUnsafe('UPDATE Student SET academicYearId = ? WHERE academicYearId = ?', standardId, oldId);
                    await client.$executeRawUnsafe('UPDATE bos_stages SET academicYearId = ? WHERE academicYearId = ?', standardId, oldId);
                    await client.$executeRawUnsafe('UPDATE bos_allocations SET academicYearId = ? WHERE academicYearId = ?', standardId, oldId);

                    // B. Update RabPlans (Composite Primary Keys)
                    const plans = await client.rabPlan.findMany({ where: { academicYearId: oldId } });
                    for (const plan of plans) {
                        const parts = plan.id.split('-');
                        const unitSuffix = parts.length > 1 ? parts.slice(1).join('-') : null;
                        if (!unitSuffix) continue;
                        const newPlanId = `${standardId}-${unitSuffix}`;

                        await client.$executeRawUnsafe('UPDATE rab_plans SET id = ?, academicYearId = ? WHERE id = ?', newPlanId, standardId, plan.id);
                    }

                    // C. Finally update the AcademicYear ID itself
                    await client.$executeRawUnsafe(`UPDATE \`${targetTable}\` SET id = ? WHERE id = ?`, standardId, oldId);

                    console.log(`[NUCLEAR-FIX] SUCCESS: ${year.name} migrated.`);
                }
            }
        } finally {
            // 2. Re-enable Foreign Key Checks
            await client.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
        }

        console.log('[NUCLEAR-FIX] Migration complete.');
    } catch (error) {
        console.error(`[NUCLEAR-FIX ERROR] ${error.message}`);
    }
};

const ensureSuperAdmin = async () => {
    try {
        const client = getPrisma();
        console.log('[Seed] Ensuring superadmin "adminsdit1" exists (Force Upsert)...');

        const hashedPassword = await bcrypt.hash('admin123', 10);
        await client.user.upsert({
            where: { username: 'adminsdit1' },
            update: {
                password: hashedPassword, // Reset password if user exists
                role: 'superadmin',
                isDeleted: false
            },
            create: {
                username: 'adminsdit1',
                password: hashedPassword,
                name: 'Super Admin',
                role: 'superadmin'
            }
        });
        console.log('[Seed] Superadmin "adminsdit1" is ready.');
    } catch (error) {
        console.error(`[Seed Error] SuperAdmin Force Reset: ${error.message}`);
    }
};

const recoverOrphanedStudents = async () => {
    try {
        const client = getPrisma();
        console.log('[STUDENT-RECOVERY] Starting relationship scan...');

        // 1. Detect student table name
        const rawTables = await client.$queryRaw`SHOW TABLES`;
        const tables = rawTables.map(t => Object.values(t)[0]);
        const studentTable = tables.find(t => t.toLowerCase() === 'student' || t.toLowerCase() === 'students');

        if (!studentTable) {
            console.error('[STUDENT-RECOVERY ERROR] Student table not found.');
            return;
        }

        // 2. Map all current academic years (standard format)
        const activeYears = await client.academicYear.findMany({ where: { isDeleted: false } });

        // 3. Perform a mass re-link for any student pointing to a non-existent ID
        // We match by checking if the old ID was recently migrated
        // Or simpler: Re-run the migration logic specifically for the student table
        for (const year of activeYears) {
            const standardId = year.id;
            // The old ID format was likely ACA-ID-... or a UUID
            // We'll re-link any student whose ID doesn't exist but who should be here
            await client.$executeRawUnsafe(`UPDATE \`${studentTable}\` SET academicYearId = ? WHERE academicYearId NOT IN (SELECT id FROM AcademicYear) AND academicYearId IS NOT NULL`, standardId);
        }

        console.log('[STUDENT-RECOVERY] Relationship scan completed.');
    } catch (error) {
        console.error(`[STUDENT-RECOVERY ERROR] ${error.message}`);
    }
};

const emergencyRestoreYears = async () => {
    try {
        const client = getPrisma();
        const targets = ['2026-2027', '2025-2026'];
        console.log(`[EMERGENCY-RECOVERY] Checking for hidden data: ${targets.join(', ')}`);

        for (const name of targets) {
            const year = await client.academicYear.findFirst({
                where: { name: name }
            });

            if (year) {
                console.log(`[EMERGENCY-RECOVERY] Restoring ${name} (ID: ${year.id})...`);
                await client.academicYear.update({
                    where: { id: year.id },
                    data: { isDeleted: false, isActive: true }
                });

                // Ensure related students are also visible if they were linked
                await client.student.updateMany({
                    where: { academicYearId: year.id, isDeleted: true },
                    data: { isDeleted: false }
                });
            }
        }
        console.log('[EMERGENCY-RECOVERY] Restoration tasks completed.');
    } catch (error) {
        console.error(`[EMERGENCY-RECOVERY ERROR] ${error.message}`);
    }
};

// Server Listening with Robust Error Handling
const ensureRabPlansColumns = async () => {
    try {
        const client = getPrisma();
        const tableVariations = ['rab_plans', 'RabPlan', 'rabplan'];
        let targetTable = null;

        for (const t of tableVariations) {
            try {
                await client.$queryRawUnsafe(`DESCRIBE \`${t}\``);
                targetTable = t;
                break;
            } catch (e) { }
        }

        if (!targetTable) {
            console.warn('[Self-Healing] rab_plans table not found, will rely on prisma db push.');
            return;
        }

        const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
        const hasCol = (name) => columns.some(c => (c.Field || c.field) === name);

        const toAdd = [
            { name: 'notified', sql: `ADD COLUMN notified BOOLEAN NOT NULL DEFAULT FALSE` },
            { name: 'updatedBy', sql: `ADD COLUMN updatedBy VARCHAR(255)` },
            { name: 'rejectionReason', sql: `ADD COLUMN rejectionReason TEXT` },
            { name: 'fieldId', sql: `ADD COLUMN fieldId VARCHAR(255)` },
            { name: 'unitId', sql: `ADD COLUMN unitId VARCHAR(255)` },
            { name: 'status', sql: `ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'` },
        ];

        for (const col of toAdd) {
            if (!hasCol(col.name)) {
                console.log(`[Self-Healing] Adding ${col.name} column to ${targetTable}...`);
                await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ${col.sql}`);
            }
        }

        console.log(`[Self-Healing] rab_plans columns verified.`);
    } catch (error) {
        console.error(`[Self-Healing Error] rab_plans columns: ${error.message}`);
    }
};

const ensureBudgetSourceColumns = async () => {
    try {
        const client = getPrisma();
        
        // 1. budget_requests
        const reqColumns = await client.$queryRawUnsafe(`DESCRIBE \`budget_requests\``);
        if (!reqColumns.some(c => (c.Field || c.field) === 'source')) {
            console.log(`[Self-Healing] Adding source column to budget_requests...`);
            await client.$executeRawUnsafe(`ALTER TABLE \`budget_requests\` ADD COLUMN source VARCHAR(20)`);
        }

        // 2. budget_reports
        const repColumns = await client.$queryRawUnsafe(`DESCRIBE \`budget_reports\``);
        if (!repColumns.some(c => (c.Field || c.field) === 'source')) {
            console.log(`[Self-Healing] Adding source column to budget_reports...`);
            await client.$executeRawUnsafe(`ALTER TABLE \`budget_reports\` ADD COLUMN source VARCHAR(20)`);
        }
        if (!repColumns.some(c => (c.Field || c.field) === 'planId')) {
            console.log(`[Self-Healing] Adding planId column to budget_reports...`);
            await client.$executeRawUnsafe(`ALTER TABLE \`budget_reports\` ADD COLUMN planId VARCHAR(100)`);
        }

        console.log(`[Self-Healing] Budget source columns verified.`);
    } catch (error) {
        console.error(`[Self-Healing Error] Budget source columns: ${error.message}`);
    }
};

const ensureBosAllocationColumns = async () => {
    try {
        const client = getPrisma();
        const tableVariations = ['bos_allocations', 'BosAllocation', 'bosallocation'];
        let targetTable = null;

        for (const t of tableVariations) {
            try {
                await client.$queryRawUnsafe(`DESCRIBE \`${t}\``);
                targetTable = t;
                break;
            } catch (e) { }
        }

        if (!targetTable) return;

        const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
        const hasExpenseItem = columns.some(c => (c.Field || c.field) === 'expenseItemId');

        if (!hasExpenseItem) {
            console.log(`[Self-Healing] Adding expenseItemId column to ${targetTable}...`);
            await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN expenseItemId VARCHAR(255)`);
        }

        console.log(`[Self-Healing] bos_allocations columns verified.`);
    } catch (error) {
        console.error(`[Self-Healing Error] bos_allocations columns: ${error.message}`);
    }
};

const ensureStudentGenderColumn = async () => {
    try {
        const client = getPrisma();
        const tableVariations = ['Student', 'students', 'student'];
        let targetTable = null;

        for (const t of tableVariations) {
            try {
                await client.$queryRawUnsafe(`DESCRIBE \`${t}\``);
                targetTable = t;
                break;
            } catch (e) { }
        }

        if (!targetTable) return;

        const columns = await client.$queryRawUnsafe(`DESCRIBE \`${targetTable}\``);
        const hasGender = columns.some(c => (c.Field || c.field) === 'gender');

        if (!hasGender) {
            console.log(`[Self-Healing] Adding gender column to ${targetTable}...`);
            await client.$executeRawUnsafe(`ALTER TABLE \`${targetTable}\` ADD COLUMN gender VARCHAR(20)`);
        }

        console.log(`[Self-Healing] Student gender column verified.`);
    } catch (error) {
        console.error(`[Self-Healing Error] Student gender column: ${error.message}`);
    }
};


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
            // 1. CRITICAL: Fixed broken startup chain by prioritizing healing
            await healAcademicYearIds();
            await emergencyRestoreYears(); // Emergency Recovery for 2026-2027
            await recoverOrphanedStudents(); // Re-link students to corrected IDs

            // 2. Regular Seeding & Setup
            await ensureSuperAdmin();
            await ensureFundSources();
            await ensureAcademicYears();
            await ensureDistributionColumns();
            await ensureRabPlansColumns();
            await ensureBudgetOperationalColumns();
            await ensureBosAllocationColumns();
            await ensureBudgetSourceColumns();
            await ensureStudentGenderColumn();

            console.log('[Background Tasks] All startup checks completed successfully.');

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
