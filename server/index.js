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

// Bulk Sync Endpoint (for legacy support and master data initialization)
// Global for debugging sync
let lastSyncStats = null;

// Bulk Sync Endpoint (for legacy support and master data initialization)
app.post('/api/sync', async (req, res) => {
    try {
        const client = getPrisma();
        lastSyncError = null; // Reset for new attempt
        
        const { 
            accounts, journals, assets, programs, users, budgets, 
            fields, units, students, incomeItems, expenseItems, 
            academicYears, classGroups, positions, studentStatuses, parentStatuses,
            budgetRequests, budgetReports, classes, distributionSettings
        } = req.body;

        // Record stats for health check diagnostics
        lastSyncStats = {
            timestamp: new Date().toISOString(),
            studentsCount: students?.length || 0,
            academicYearsCount: academicYears?.length || 0,
            unitsCount: units?.length || 0,
            firstStudent: students?.[0]?.name || 'N/A',
            payloadSize: JSON.stringify(req.body || {}).length
        };
        
        console.log(`[Sync] Starting sync. Payload size: ${JSON.stringify(req.body || {}).length} bytes`);
        console.log(`[Sync] Received: Students=${students?.length || 0}, Classes=${classes?.length || 0}, AcademicYears=${academicYears?.length || 0}`);
        
        if (!students || !Array.isArray(students)) {
            throw new Error('Students array is missing or invalid');
        }
        if (!classes || !Array.isArray(classes)) {
            throw new Error('Classes array is missing or invalid');
        }
        
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

            // 4. Sync Academic Years (Removing non-existent startDate/endDate)
            if (academicYears && Array.isArray(academicYears)) {
                for (const ay of academicYears) {
                    try {
                        await tx.academicYear.upsert({
                            where: { id: ay.id },
                            update: { 
                                name: ay.name, 
                                isCurrent: ay.isCurrent || false, 
                                isDeleted: ay.isDeleted || false 
                            },
                            create: { 
                                id: ay.id, 
                                name: ay.name, 
                                isCurrent: ay.isCurrent || false, 
                                isDeleted: ay.isDeleted || false 
                            }
                        });
                    } catch (ayError) {
                        console.error(`[Sync Error] Academic Year ${ay.name}: ${ayError.message}`);
                    }
                }
            }

            // 5. Sync Positions
            if (positions && Array.isArray(positions)) {
                for (const pos of positions) {
                    try {
                        await tx.position.upsert({
                            where: { id: pos.id },
                            update: { name: pos.name, isDeleted: pos.isDeleted || false },
                            create: { id: pos.id, name: pos.name, isDeleted: pos.isDeleted || false }
                        });
                    } catch (err) {
                        console.error(`[Sync Error] Position ${pos.name}: ${err.message}`);
                    }
                }
            }

            // 6. Sync Student Statuses
            if (studentStatuses && Array.isArray(studentStatuses)) {
                for (const ss of studentStatuses) {
                    try {
                        await tx.studentStatus.upsert({
                            where: { id: ss.id },
                            update: { name: ss.name, isDeleted: ss.isDeleted || false },
                            create: { id: ss.id, name: ss.name, isDeleted: ss.isDeleted || false }
                        });
                    } catch (err) {
                        console.error(`[Sync Error] Student Status ${ss.name}: ${err.message}`);
                    }
                }
            }

            // 7. Sync Parent Statuses
            if (parentStatuses && Array.isArray(parentStatuses)) {
                for (const ps of parentStatuses) {
                    try {
                        await tx.parentStatus.upsert({
                            where: { id: ps.id },
                            update: { name: ps.name, isDeleted: ps.isDeleted || false },
                            create: { id: ps.id, name: ps.name, isDeleted: ps.isDeleted || false }
                        });
                    } catch (err) {
                        console.error(`[Sync Error] Parent Status ${ps.name}: ${err.message}`);
                    }
                }
            }

            // 8. Sync Income Items
            if (incomeItems && Array.isArray(incomeItems)) {
                for (const ii of incomeItems) {
                    try {
                        await tx.incomeItem.upsert({
                            where: { id: ii.id },
                            update: { name: ii.name, isDeleted: ii.isDeleted || false },
                            create: { id: ii.id, name: ii.name, isDeleted: ii.isDeleted || false }
                        });
                    } catch (err) {
                        console.error(`[Sync Error] Income Item ${ii.name}: ${err.message}`);
                    }
                }
            }

            // 9. Sync ClassGroups
            if (classGroups && Array.isArray(classGroups)) {
                for (const cg of classGroups) {
                    try {
                        await tx.classGroup.upsert({
                            where: { id: cg.id },
                            update: { name: cg.name, isDeleted: cg.isDeleted || false },
                            create: { id: cg.id, name: cg.name, isDeleted: cg.isDeleted || false }
                        });
                    } catch (err) {
                        console.error(`[Sync Error] Class Group ${cg.name}: ${err.message}`);
                    }
                }
            }

            // 10. Sync Classes (The actual unit-specific classes)
            if (classes && Array.isArray(classes)) {
                for (const cls of classes) {
                    console.log(`[Sync] Processing Class: ${cls.name} (ID: ${cls.id})`);
                    await tx.class.upsert({
                        where: { id: cls.id },
                        update: { name: cls.name, unitId: cls.unitId, isDeleted: cls.isDeleted || false },
                        create: { id: cls.id, name: cls.name, unitId: cls.unitId, isDeleted: cls.isDeleted || false }
                    });
                }
            }

            // 11. Sync Students (Now everything they depend on is synced)
            if (students && Array.isArray(students)) {
                const incomingIds = students.map(s => s.id);
                
                // Mark students as deleted if they are not in the incoming payload (Mirror local state)
                const deactivated = await tx.student.updateMany({
                    where: { 
                        id: { notIn: incomingIds },
                        isDeleted: false
                    },
                    data: { isDeleted: true }
                });

                if (deactivated.count > 0) {
                    console.log(`[Sync] Deactivated ${deactivated.count} students not present in payload`);
                    if (lastSyncStats) lastSyncStats.deactivatedCount = deactivated.count;
                }

                const validUnitIds = (units || []).map(u => u.id);
                const validClassIds = (classes || []).map(c => c.id);
                const validYearIds = (academicYears || []).map(y => y.id);
                const validStatusIds = (studentStatuses || []).map(s => s.id);
                const validParentIds = (parentStatuses || []).map(p => p.id);

                console.log(`[Sync Debug] Valid IDs: Units=${validUnitIds.length}, Classes=${validClassIds.length}, Years=${validYearIds.length}, Statuses=${validStatusIds.length}`);

                for (const s of students) {
                    // 1. Validate UnitID is essential (Cannot be NULL in DB)
                    // If the student has a unitId not in our payload/DB, we must find a fallback or skip
                    const unitId = (s.unitId && validUnitIds.includes(s.unitId)) ? s.unitId : validUnitIds[0];
                    
                    if (!unitId) {
                        console.error(`[Sync Skip] Student ${s.name} skipped: No valid unitId found.`);
                        continue;
                    }

                    // 2. Validate optional relations
                    const classId = (s.classId && validClassIds.includes(s.classId)) ? s.classId : null;
                    const academicYearId = (s.academicYearId && validYearIds.includes(s.academicYearId)) ? s.academicYearId : null;
                    const statusId = (s.statusId && validStatusIds.includes(s.statusId)) ? s.statusId : null;
                    const parentStatusId = (s.parentStatusId && validParentIds.includes(s.parentStatusId)) ? s.parentStatusId : null;
                    
                    const nisValue = (s.nis && s.nis.trim() !== '') ? s.nis.trim() : `AUTO-${s.id.substring(0, 8)}`;

                    try {
                        // UPSERT Student first
                        await tx.student.upsert({
                            where: { id: s.id },
                            update: { 
                                nis: nisValue, name: s.name, unitId: unitId, 
                                classId: classId, academicYearId: academicYearId, 
                                statusId: statusId, parentStatusId: parentStatusId,
                                isDeleted: s.isDeleted || false 
                            },
                            create: { 
                                id: s.id, nis: nisValue, name: s.name, unitId: unitId, 
                                classId: classId, academicYearId: academicYearId, 
                                statusId: statusId, parentStatusId: parentStatusId,
                                isDeleted: s.isDeleted || false 
                            }
                        });

                        // ONLY if student upsert succeeded, sync Income Details
                        if (s.incomeDetails && Array.isArray(s.incomeDetails)) {
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
                                            amount: parseFloat(detail.amount) || 0
                                        }
                                    });
                                }
                            }
                        }
                        console.log(`[Sync Success] Student ${s.name} processed fully.`);
                    } catch (studentErr) {
                        console.error(`[Sync Fatal] Student ${s.name} (${s.id}) failed: ${studentErr.message}`);
                        throw new Error(`Sync Student ${s.name} failed: ${studentErr.message}`);
                    }
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

        res.json({ 
            status: 'ok', 
            message: 'Synchronization completed successfully',
            counts: {
                students: students?.length || 0,
                classes: classes?.length || 0,
                academicYears: academicYears?.length || 0
            }
        });
    } catch (error) {
        lastSyncError = `Global Sync Error: ${error.message}`;
        console.error(`[Sync Error] ${lastSyncError}`);
        res.status(500).json({ error: error.message });
    }
});

// Advanced Health Check (Verifies Prisma)
app.get('/api/health', async (req, res) => {
        const client = getPrisma();
        let stats = null;
        let dbContent = null;
        let dbError = null;

        try {
            const studentCount = await client.student.count({ where: { isDeleted: false } });
            const classCount = await client.class.count({ where: { isDeleted: false } });
            const deletedStudentCount = await client.student.count({ where: { isDeleted: true } });
            const deletedClassCount = await client.class.count({ where: { isDeleted: true } });
            const incomeItemCount = await client.incomeItem.count({ where: { isDeleted: false } });
            const userCount = await client.user.count({ where: { isDeleted: false } });
            const fieldCount = await client.field.count({ where: { isDeleted: false } });
            const unitCount = await client.unit.count({ where: { isDeleted: false } });
            const ayCount = await client.academicYear.count({ where: { isDeleted: false } });
            const posCount = await client.position.count({ where: { isDeleted: false } });
            const stStatusCount = await client.studentStatus.count({ where: { isDeleted: false } });
            const ptStatusCount = await client.parentStatus.count({ where: { isDeleted: false } });

            const studentList = await client.student.findMany({ where: { isDeleted: false }, take: 5, select: { name: true } });
            const classList = await client.class.findMany({ where: { isDeleted: false }, take: 5, select: { name: true } });

            stats = {
                students: studentCount,
                deletedStudents: deletedStudentCount,
                classes: classCount,
                deletedClasses: deletedClassCount,
                incomeItems: incomeItemCount,
                academicYears: ayCount,
                positions: posCount,
                studentStatuses: stStatusCount,
                parentStatuses: ptStatusCount,
                users: userCount,
                fields: fieldCount,
                units: unitCount
            };
            dbContent = {
                students: studentList.map(s => s.name),
                classes: classList.map(c => c.name)
            };
        } catch (dbErr) {
            console.error(`[Health DB Error] ${dbErr.message}`);
            dbError = dbErr.message;
        }

        res.json({ 
            status: 'ok', 
            version: '1.3.2', 
            database: dbError ? 'error' : 'connected',
            dbError: dbError,
            lastSyncError: lastSyncError,
            lastSyncStats: lastSyncStats,
            dbContent: dbContent,
            stats: stats,
            message: 'SIKAK Yayasan Umum API is running',
            env: {
                DATABASE_URL: maskedDBUrl ? 'SET' : 'NOT SET',
                NODE_ENV: process.env.NODE_ENV
            }
        });
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
