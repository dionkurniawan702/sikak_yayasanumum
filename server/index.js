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
        prisma = new PrismaClient();
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
app.use(express.json());

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

// Bulk Sync Endpoint (for legacy support and master data initialization)
app.post('/api/sync', async (req, res) => {
    try {
        const client = getPrisma();
        const { 
            accounts, journals, assets, programs, users, budgets, 
            fields, units, students, incomeItems, expenseItems, 
            academicYears, classGroups, positions, studentStatuses, parentStatuses,
            budgetRequests, budgetReports, classes, distributionSettings
        } = req.body;
        
        console.log(`[Sync] Processing bulk update from client`);
        
        // Use a transaction for master data
        await client.$transaction(async (tx) => {
            // 1. Sync Fields
            if (fields && Array.isArray(fields)) {
                for (const field of fields) {
                    await tx.field.upsert({
                        where: { id: field.id },
                        update: { name: field.name, isDeleted: field.isDeleted || false },
                        create: { id: field.id, name: field.name, isDeleted: field.isDeleted || false }
                    });
                }
            }

            // 2. Sync Units
            if (units && Array.isArray(units)) {
                for (const unit of units) {
                    await tx.unit.upsert({
                        where: { id: unit.id },
                        update: { 
                            name: unit.name, 
                            fieldId: unit.fieldId, 
                            isDeleted: unit.isDeleted || false 
                        },
                        create: { 
                            id: unit.id, 
                            name: unit.name, 
                            fieldId: unit.fieldId, 
                            isDeleted: unit.isDeleted || false 
                        }
                    });
                }
            }

            // 3. Sync Users
            if (users && Array.isArray(users)) {
                for (const user of users) {
                    await tx.user.upsert({
                        where: { id: user.id },
                        update: {
                            name: user.name,
                            username: user.username,
                            password: user.password,
                            role: user.role,
                            fieldId: user.fieldId,
                            unitId: user.unitId,
                            isDeleted: user.isDeleted || false
                        },
                        create: {
                            id: user.id,
                            name: user.name,
                            username: user.username,
                            password: user.password,
                            role: user.role,
                            fieldId: user.fieldId,
                            unitId: user.unitId,
                            isDeleted: user.isDeleted || false
                        }
                    });
                }
            }

            // 4. Sync ClassGroups
            if (classGroups && Array.isArray(classGroups)) {
                for (const cg of classGroups) {
                    await tx.classGroup.upsert({
                        where: { id: cg.id },
                        update: { name: cg.name, isDeleted: cg.isDeleted || false },
                        create: { id: cg.id, name: cg.name, isDeleted: cg.isDeleted || false }
                    });
                }
            }

            // 4b. Sync Classes (The actual unit-specific classes)
            if (classes && Array.isArray(classes)) {
                for (const cls of classes) {
                    await tx.class.upsert({
                        where: { id: cls.id },
                        update: { name: cls.name, unitId: cls.unitId, isDeleted: cls.isDeleted || false },
                        create: { id: cls.id, name: cls.name, unitId: cls.unitId, isDeleted: cls.isDeleted || false }
                    });
                }
            }

            // 5. Sync Students
            if (students && Array.isArray(students)) {
                for (const s of students) {
                    try {
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

                        // Sync Student Income Details
                        if (s.incomeDetails && Array.isArray(s.incomeDetails)) {
                            // Only sync valid items
                            const validIncomeItems = await tx.incomeItem.findMany({ 
                                where: { id: { in: s.incomeDetails.map(d => d.incomeItemId) }, isDeleted: false }
                            });
                            const validIds = validIncomeItems.map(i => i.id);

                            await tx.studentIncomeDetail.deleteMany({ where: { studentId: s.id } });
                            for (const detail of s.incomeDetails) {
                                if (validIds.includes(detail.incomeItemId)) {
                                    await tx.studentIncomeDetail.create({
                                        data: {
                                            studentId: s.id,
                                            incomeItemId: detail.incomeItemId,
                                            amount: detail.amount
                                        }
                                    });
                                }
                            }
                        }
                    } catch (studentError) {
                        lastSyncError = `Student ${s.name} (${s.id}): ${studentError.message}`;
                        console.error(`[Sync Error] ${lastSyncError}`);
                        // Don't fail the whole transaction for one student
                    }
                }
            }

            // 6. Sync Academic Years
            if (academicYears && Array.isArray(academicYears)) {
                for (const ay of academicYears) {
                    try {
                        const startDate = (ay.startDate && !isNaN(new Date(ay.startDate))) ? new Date(ay.startDate) : new Date(`${new Date().getFullYear()}-01-01`);
                        const endDate = (ay.endDate && !isNaN(new Date(ay.endDate))) ? new Date(ay.endDate) : new Date(`${new Date().getFullYear()}-12-31`);

                        await tx.academicYear.upsert({
                            where: { id: ay.id },
                            update: { 
                                name: ay.name, 
                                startDate, 
                                endDate, 
                                isCurrent: ay.isCurrent || false, 
                                isDeleted: ay.isDeleted || false 
                            },
                            create: { 
                                id: ay.id, 
                                name: ay.name, 
                                startDate, 
                                endDate, 
                                isCurrent: ay.isCurrent || false, 
                                isDeleted: ay.isDeleted || false 
                            }
                        });
                    } catch (ayError) {
                        console.error(`[Sync Error] Academic Year ${ay.name}: ${ayError.message}`);
                    }
                }
            }

            // 7. Sync Positions
            if (positions && Array.isArray(positions)) {
                for (const pos of positions) {
                    await tx.position.upsert({
                        where: { id: pos.id },
                        update: { name: pos.name, isDeleted: pos.isDeleted || false },
                        create: { id: pos.id, name: pos.name, isDeleted: pos.isDeleted || false }
                    });
                }
            }

            // 8. Sync Student Statuses
            if (studentStatuses && Array.isArray(studentStatuses)) {
                for (const ss of studentStatuses) {
                    await tx.studentStatus.upsert({
                        where: { id: ss.id },
                        update: { name: ss.name, isDeleted: ss.isDeleted || false },
                        create: { id: ss.id, name: ss.name, isDeleted: ss.isDeleted || false }
                    });
                }
            }

            // 9. Sync Parent Statuses
            if (parentStatuses && Array.isArray(parentStatuses)) {
                for (const ps of parentStatuses) {
                    await tx.parentStatus.upsert({
                        where: { id: ps.id },
                        update: { name: ps.name, isDeleted: ps.isDeleted || false },
                        create: { id: ps.id, name: ps.name, isDeleted: ps.isDeleted || false }
                    });
                }
            }

            // 10. Sync Income Items
            if (incomeItems && Array.isArray(incomeItems)) {
                for (const ii of incomeItems) {
                    await tx.incomeItem.upsert({
                        where: { id: ii.id },
                        update: { name: ii.name, isDeleted: ii.isDeleted || false },
                        create: { id: ii.id, name: ii.name, isDeleted: ii.isDeleted || false }
                    });
                }
            }

            // 11. Sync Expense Items
            if (expenseItems && Array.isArray(expenseItems)) {
                for (const ei of expenseItems) {
                    await tx.expenseItem.upsert({
                        where: { id: ei.id },
                        update: { 
                            name: ei.name, unitId: ei.unitId, fieldId: ei.fieldId, 
                            accountId: ei.accountId, sourceOfFunds: ei.sourceOfFunds,
                            isBos: ei.isBos || false, isDeleted: ei.isDeleted || false 
                        },
                        create: { 
                            id: ei.id, name: ei.name, unitId: ei.unitId, fieldId: ei.fieldId, 
                            accountId: ei.accountId, sourceOfFunds: ei.sourceOfFunds,
                            isBos: ei.isBos || false, isDeleted: ei.isDeleted || false 
                        }
                    });
                }
            }

            // 12. Sync Distribution Settings
            if (distributionSettings && Array.isArray(distributionSettings)) {
                for (const ds of distributionSettings) {
                    await tx.distributionSetting.upsert({
                        where: { id: ds.id },
                        update: { 
                            unitId: ds.unitId, incomeItemId: ds.incomeItemId, 
                            expenseItemId: ds.expenseItemId, percentage: ds.percentage,
                            isDeleted: ds.isDeleted || false 
                        },
                        create: { 
                            id: ds.id, unitId: ds.unitId, incomeItemId: ds.incomeItemId, 
                            expenseItemId: ds.expenseItemId, percentage: ds.percentage,
                            isDeleted: ds.isDeleted || false 
                        }
                    });
                }
            }
        });

        res.json({ status: 'ok', message: 'Synchronization completed successfully' });
    } catch (error) {
        lastSyncError = `Global Sync Error: ${error.message}`;
        console.error(`[Sync Error] ${lastSyncError}`);
        res.status(500).json({ error: error.message });
    }
});

// Advanced Health Check (Verifies Prisma)
app.get('/api/health', async (req, res) => {
    try {
        const client = getPrisma();
        await client.$queryRaw`SELECT 1`;
        
        // Quick diagnostic counts
        const studentCount = await client.student.count({ where: { isDeleted: false } });
        const incomeItemCount = await client.incomeItem.count({ where: { isDeleted: false } });
        const userCount = await client.user.count({ where: { isDeleted: false } });
        const fieldCount = await client.field.count({ where: { isDeleted: false } });
        const unitCount = await client.unit.count({ where: { isDeleted: false } });
        const classCount = await client.class.count({ where: { isDeleted: false } });
        const ayCount = await client.academicYear.count({ where: { isDeleted: false } });
        const posCount = await client.position.count({ where: { isDeleted: false } });
        const stStatusCount = await client.studentStatus.count({ where: { isDeleted: false } });
        const ptStatusCount = await client.parentStatus.count({ where: { isDeleted: false } });

        res.json({ 
            status: 'ok', 
            version: '1.1.3',
            database: 'connected',
            lastSyncError: lastSyncError,
            stats: {
                students: studentCount,
                incomeItems: incomeItemCount,
                academicYears: ayCount,
                positions: posCount,
                studentStatuses: stStatusCount,
                parentStatuses: ptStatusCount,
                users: userCount,
                fields: fieldCount,
                units: unitCount,
                classes: classCount
            },
            message: 'SIKAK Yayasan Umum API is running',
            env: {
                DATABASE_URL: maskedDBUrl ? 'SET' : 'NOT SET',
                NODE_ENV: process.env.NODE_ENV
            }
        });
    } catch (error) {
        console.error(`[DB Error] ${error.message}`);
        res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});

// 4.1 Manual Seeding Endpoint (Debug)
app.get('/api/seed', async (req, res) => {
    try {
        console.log('[Manual Seed] Executing...');
        const { execSync } = await import('child_process');
        const output = execSync('node prisma/seed_yayasan_final.cjs').toString();
        
        // Also ensure fund sources via internal function as fallback
        await ensureFundSources();

        res.json({ 
            status: 'ok', 
            message: 'Seeding triggered successfully', 
            output: output 
        });
    } catch (error) {
        console.error(`[Manual Seed Error] ${error.message}`);
        res.status(500).json({ status: 'error', error: error.message });
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
