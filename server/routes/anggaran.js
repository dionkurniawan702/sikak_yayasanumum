import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { recordAudit } from './audit.js';
const router = express.Router();

// Helper to get Prisma Client from the request (attached in index.js)
const getPrisma = (req) => req.app.get('prisma');
const withRetry = (req, fn) => req.app.get('withRetry')(fn);

const JWT_SECRET = process.env.JWT_SECRET || 'sikad-dareliman-secret-2026';

// Middleware: Hanya superadmin yang boleh akses
const requireSuperAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ error: 'Akses ditolak: Hanya Superadmin yang dapat melakukan operasi ini.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
    }
};

// Middleware: Memeriksa JWT token untuk user yang telah login
const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
    }
};

// Helper: Safe date parsing (handles Excel serial number e.g. 46301, DD-MM-YYYY, YYYY-MM-DD, etc.)
function parseSafeDate(rawDate) {
    if (!rawDate) return new Date();
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        return rawDate;
    }
    // Check if numeric or Excel serial number (e.g. 46301)
    if (typeof rawDate === 'number' || (/^\d{4,6}(\.\d+)?$/.test(String(rawDate).trim()) && !String(rawDate).includes('-') && !String(rawDate).includes('/'))) {
        const num = typeof rawDate === 'number' ? rawDate : parseFloat(String(rawDate).trim());
        if (num > 1000 && num < 100000) {
            const dateFromSerial = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(dateFromSerial.getTime())) {
                return dateFromSerial;
            }
        }
    }
    const str = String(rawDate).trim();
    // DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10) - 1;
        const year = parseInt(ddmmyyyy[3], 10);
        return new Date(Date.UTC(year, month, day));
    }
    // YYYY-MM-DD or YYYY/MM/DD
    const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (yyyymmdd) {
        const year = parseInt(yyyymmdd[1], 10);
        const month = parseInt(yyyymmdd[2], 10) - 1;
        const day = parseInt(yyyymmdd[3], 10);
        return new Date(Date.UTC(year, month, day));
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getUTCFullYear() > 1990 && parsed.getUTCFullYear() < 2100) {
        return parsed;
    }
    return new Date();
}

// --- FIELD & UNIT ---
router.get('/fields', async (req, res) => {
    try {
        const fields = await getPrisma(req).field.findMany({
            where: { isDeleted: false },
            include: { units: true }
        });
        res.json({ data: fields });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/fields', async (req, res) => {
    try {
        const cleanData = {
            name: req.body.name,
            isDeleted: req.body.isDeleted !== undefined ? !!req.body.isDeleted : false
        };

        // Check for existing name to provide better error
        const existing = await getPrisma(req).field.findFirst({
            where: { name: cleanData.name, isDeleted: false }
        });
        if (existing) {
            return res.status(400).json({ error: `Bidang dengan nama "${cleanData.name}" sudah ada.` });
        }

        const field = await getPrisma(req).field.create({ data: cleanData });
        res.json({ data: field });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: `Ops! Bidang dengan nama "${req.body.name}" sudah ada.` });
        res.status(500).json({ error: error.message });
    }
});

router.put('/fields/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Clean data for Field model - prevent extra fields or relation objects
        const cleanData = {
            name: req.body.name,
            isDeleted: req.body.isDeleted !== undefined ? !!req.body.isDeleted : false
        };

        console.log(`[API] Upserting Field ${id}: ${JSON.stringify(cleanData)}`);
        const field = await getPrisma(req).field.upsert({
            where: { id },
            update: cleanData,
            create: { ...cleanData, id }
        });
        res.json({ data: field });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: `Gagal memperbarui: Nama bidang "${req.body.name}" sudah ada.` });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/fields/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;

        if (isPermanent) {
            const units = await getPrisma(req).unit.count({ where: { fieldId: req.params.id } });
            if (units > 0) {
                return res.status(400).json({
                    error: `Tidak bisa menghapus: Masih ada ${units} Unit yang terhubung ke Bidang ini. Hapus Unitnya terlebih dahulu.`
                });
            }
            await getPrisma(req).field.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).field.update({
                where: { id: req.params.id },
                data: { isDeleted: true, updatedBy: req.body?.updatedBy || 'System' }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        let msg = error.message;
        if (error.code === 'P2003') msg = "Gagal menghapus: Data ini masih digunakan oleh tabel lain.";
        res.status(500).json({ error: msg });
    }
});

router.get('/units', async (req, res) => {
    try {
        const units = await getPrisma(req).unit.findMany({
            where: { isDeleted: false },
            include: { field: true }
        });
        res.json({ data: units });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/units', async (req, res) => {
    try {
        const cleanData = {
            id: req.body.id,
            name: req.body.name,
            fieldId: req.body.fieldId,
            receivesBos: req.body.receivesBos !== undefined ? !!req.body.receivesBos : undefined,
            isDeleted: req.body.isDeleted !== undefined ? !!req.body.isDeleted : false
        };

        // Remove undefined fields
        Object.keys(cleanData).forEach(key => cleanData[key] === undefined && delete cleanData[key]);

        console.log(`[API] Creating new Unit: ${JSON.stringify(cleanData)}`);

        // Pre-check for duplicate name in the same field
        const existing = await withRetry(req, () => getPrisma(req).unit.findFirst({
            where: { 
                name: cleanData.name, 
                fieldId: cleanData.fieldId,
                isDeleted: false 
            }
        }));
        
        if (existing) {
            return res.status(400).json({ error: `Gagal menyimpan: Nama unit "${cleanData.name}" sudah digunakan di bidang ini.` });
        }

        const unit = await getPrisma(req).unit.create({ data: cleanData });
        console.log(`[API] Unit created successfully: ${unit.id}`);
        res.json({ data: unit });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: `Nama unit "${req.body.name}" sudah digunakan di bidang ini.` });
        res.status(500).json({ error: error.message });
    }
});

router.put('/units/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        // Clean data for Unit model - prevent extra fields or relation objects (like 'field')
        const cleanData = {
            name: req.body.name,
            fieldId: req.body.fieldId,
            receivesBos: req.body.receivesBos !== undefined ? !!req.body.receivesBos : undefined,
            isDeleted: req.body.isDeleted !== undefined ? !!req.body.isDeleted : false
        };

        // Remove undefined fields to not overwrite with null if not intended
        Object.keys(cleanData).forEach(key => cleanData[key] === undefined && delete cleanData[key]);

        console.log(`[API] Upserting Unit ${id}: ${JSON.stringify(cleanData)}`);
        
        // Pre-check for duplicate name in the same field (excluding current ID) to avoid P2002 closure
        let existing = null;
        const currentUnit = await withRetry(req, () => getPrisma(req).unit.findUnique({ where: { id } }));
        if (currentUnit && currentUnit.name !== cleanData.name) {
            existing = await withRetry(req, () => getPrisma(req).unit.findFirst({
                where: { 
                    name: cleanData.name, 
                    fieldId: cleanData.fieldId, 
                    isDeleted: false 
                }
            }));
        }
        
        if (existing) {
            return res.status(400).json({ error: `Gagal menyimpan: Nama unit "${cleanData.name}" sudah digunakan di bidang ini.` });
        }

        const unit = await getPrisma(req).unit.upsert({
            where: { id },
            update: cleanData,
            create: { ...cleanData, id }
        });
        console.log(`[API] Unit upserted successfully: ${unit.id}`);
        res.json({ data: unit });
    } catch (error) {
        console.error(`[API Error] Upsert Unit failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/units/:id', async (req, res) => {
    console.log(`[Backend Trace] DELETE /units/${req.params.id} request received`);
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        console.log(`[Backend Trace] Deletion Mode: ${isPermanent ? 'Permanent' : 'Soft-delete'}`);

        if (isPermanent) {
            await getPrisma(req).unit.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).unit.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        console.log(`[Backend Trace] Deletion successful for Unit ${req.params.id}`);
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[Backend Trace] Deletion FAILED for Unit ${req.params.id}:`, error);
        let msg = error.message;
        if (error.code === 'P2003') msg = "Gagal menghapus: Unit ini masih memiliki data terkait (Siswa, Item Beban, dll).";
        res.status(500).json({ error: msg, code: error.code });
    }
});

// --- STUDENT & INCOME ---
router.get('/students', async (req, res) => {
    try {
        const students = await getPrisma(req).student.findMany({
            where: { isDeleted: false },
            include: {
                unit: true,
                class: true,
                academicYear: true,
                status: true,
                parentStatus: true,
                incomeDetails: true
            }
        });
        res.json({ data: students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/students', async (req, res) => {
    try {
        const {
            id, name, nis, unitId,
            classId, academicYearId, statusId, parentStatusId, gender,
            incomeDetails
        } = req.body;

        const prisma = getPrisma(req);

        // --- DUPLICATE CHECK ---
        const existing = await prisma.student.findFirst({
            where: {
                name: name,
                unitId: unitId,
                nis: nis || '',
                classId: classId || null,
                academicYearId: academicYearId || null,
                isDeleted: false
            }
        });
        
        if (existing) {
            return res.status(400).json({ error: `Gagal: Siswa dengan nama "${name}", NIS "${nis || '-'}", dan kelas yang sama sudah terdaftar di unit dan tahun ajaran ini.` });
        }

        const student = await prisma.student.create({
            data: {
                id, name, nis, unitId,
                classId: classId || null,
                academicYearId: academicYearId || null,
                statusId: statusId || null,
                parentStatusId: parentStatusId || null,
                gender: gender || null,
                incomeDetails: {
                    create: (incomeDetails || []).map(d => ({
                        incomeItemId: d.incomeItemId,
                        amount: parseFloat(d.amount) || 0
                    }))
                }
            }
        });
        res.json({ data: student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/students/:id', async (req, res) => {
    try {
        const {
            name, nis, unitId,
            classId, academicYearId, statusId, parentStatusId, gender,
            incomeDetails
        } = req.body;

        const prisma = getPrisma(req);

        // --- DUPLICATE CHECK ---
        const existing = await prisma.student.findFirst({
            where: {
                name: name,
                unitId: unitId,
                nis: nis || '',
                classId: classId || null,
                academicYearId: academicYearId || null,
                id: { not: req.params.id },
                isDeleted: false
            }
        });

        if (existing) {
            return res.status(400).json({ error: `Gagal: Siswa dengan nama "${name}", NIS "${nis || '-'}", dan kelas yang sama sudah digunakan oleh siswa lain di unit dan tahun ajaran ini.` });
        }

        // Transaction to update student and details
        const student = await prisma.$transaction(async (tx) => {
            if (incomeDetails) {
                await tx.studentIncomeDetail.deleteMany({ where: { studentId: req.params.id } });
            }

            return tx.student.upsert({
                where: { id: req.params.id },
                update: {
                    name, nis, unitId,
                    classId: classId || null,
                    academicYearId: academicYearId || null,
                    statusId: statusId || null,
                    parentStatusId: parentStatusId || null,
                    gender: gender || null,
                    incomeDetails: incomeDetails ? {
                        create: incomeDetails.map(d => ({
                            incomeItemId: d.incomeItemId,
                            amount: parseFloat(d.amount) || 0
                        }))
                    } : undefined,
                    isDeleted: false
                },
                create: {
                    id: req.params.id, name, nis, unitId,
                    classId: classId || null,
                    academicYearId: academicYearId || null,
                    statusId: statusId || null,
                    parentStatusId: parentStatusId || null,
                    gender: gender || null,
                    incomeDetails: {
                        create: (incomeDetails || []).map(d => ({
                            incomeItemId: d.incomeItemId,
                            amount: parseFloat(d.amount) || 0
                        }))
                    }
                }
            });
        });

        res.json({ data: student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/students/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).studentIncomeDetail.deleteMany({ where: { studentId: req.params.id } });
            await getPrisma(req).student.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).student.updateMany({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/income-items', async (req, res) => {
    try {
        const items = await getPrisma(req).incomeItem.findMany({ where: { isDeleted: false } });
        res.json({ data: items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/income-items', async (req, res) => {
    try {
        const item = await getPrisma(req).incomeItem.create({ data: req.body });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/income-items/:id', async (req, res) => {
    try {
        const item = await getPrisma(req).incomeItem.update({
            where: { id: req.params.id },
            data: { ...req.body, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
        });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/income-items/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true || true;
        if (isPermanent) {
            await getPrisma(req).incomeItem.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).incomeItem.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/expense-items', async (req, res) => {
    try {
        const items = await getPrisma(req).expenseItem.findMany({
            where: { isDeleted: false },
            include: { unit: true, field: true }
        });
        res.json({ data: items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/expense-items', async (req, res) => {
    try {
        const item = await getPrisma(req).expenseItem.create({ data: req.body });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/expense-items/:id', async (req, res) => {
    try {
        const item = await getPrisma(req).expenseItem.update({
            where: { id: req.params.id },
            data: { ...req.body, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
        });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/expense-items/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true || true;
        if (isPermanent) {
            await getPrisma(req).expenseItem.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).expenseItem.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DISTRIBUTION SETTINGS ---
router.get('/distribution-settings', async (req, res) => {
    try {
        const settings = await getPrisma(req).distributionSetting.findMany({ where: { isDeleted: false } });
        res.json({ data: settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/fix-dist-dupes', async (req, res) => {
    try {
        const client = getPrisma(req);
        const settings = await client.distributionSetting.findMany({ where: { isDeleted: false } });
        
        const keepIds = new Set();
        const deleteIds = [];
        const seenKeys = new Set();
        
        for (const s of settings) {
            // Include unitId, incomeItemId, destId, expenseItemId, and percentage to identify identical rules
            const key = `${s.unitId}-${s.incomeItemId}-${s.destId}-${s.expenseItemId}-${parseFloat(s.percentage)}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                keepIds.add(s.id);
            } else {
                deleteIds.push(s.id);
            }
        }
        
        if (deleteIds.length > 0) {
            await client.distributionSetting.deleteMany({
                where: { id: { in: deleteIds } }
            });
        }
        
        res.json({ message: `Deduplication complete. Deleted ${deleteIds.length} duplicate rules.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/distribution-settings', async (req, res) => {
    try {
        const { unitId, incomeItemId, settings, batch = false, academicYearId } = req.body;
        
        // Anti-Duplicate Guard: Filter out exact identical rules before saving
        const uniqueSettings = [];
        const seen = new Set();
        if (Array.isArray(settings)) {
            // Sort by percentage descending so if there are duplicates, we keep the one with the highest percentage
            const sortedSettings = [...settings].sort((a, b) => parseFloat(b.percentage || 0) - parseFloat(a.percentage || 0));
            for (const s of sortedSettings) {
                const key = `${s.unitId}-${s.incomeItemId}-${s.destId}-${s.destType}-${s.expenseItemId}`;
                if (!seen.has(key)) {
                    uniqueSettings.push(s);
                    seen.add(key);
                }
            }
        }

        const yearId = academicYearId || (settings && settings[0]?.academicYearId) || null;
        console.log(`[Sync] Updating distributions for Unit ${unitId}, Year: ${yearId}. Batch: ${batch}. Rules: ${settings?.length}`);

        await getPrisma(req).$transaction([
            // Forcefully delete all existing rules for the given unit, income item, and year
            getPrisma(req).distributionSetting.deleteMany({
                where: batch 
                    ? { unitId, academicYearId: yearId } 
                    : { unitId, incomeItemId, academicYearId: yearId }
            }),
            // Insert the fresh ones (preserving existing UUIDs to maintain stability and prevent unnecessary re-generation)
            getPrisma(req).distributionSetting.createMany({
                data: uniqueSettings.map(s => ({
                    id: s.id || crypto.randomUUID(),
                    unitId: s.unitId,
                    academicYearId: yearId,
                    incomeItemId: s.incomeItemId,
                    expenseItemId: s.expenseItemId,
                    destId: s.destId,
                    destType: s.destType,
                    destName: s.destName,
                    percentage: parseFloat(s.percentage) || 0
                }))
            })
        ]);
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/distribution-settings/duplicate', async (req, res) => {
    try {
        const { sourceYearId, targetYearId } = req.body;
        if (!sourceYearId || !targetYearId) {
            return res.status(400).json({ error: 'Source and Target Academic Year IDs are required' });
        }

        const prisma = getPrisma(req);
        console.log(`[Duplication] Copying distribution settings from ${sourceYearId} to ${targetYearId}`);

        // Fetch all distribution settings from source year
        const sourceSettings = await prisma.distributionSetting.findMany({
            where: { academicYearId: sourceYearId, isDeleted: false }
        });

        if (sourceSettings.length === 0) {
            return res.json({ message: 'No configurations found for the source year', count: 0 });
        }

        // Clean existing settings in target year to avoid duplicates
        await prisma.distributionSetting.deleteMany({
            where: { academicYearId: targetYearId }
        });

        // Duplicate them to the target year
        const newSettings = sourceSettings.map(s => ({
            id: crypto.randomUUID(),
            unitId: s.unitId,
            academicYearId: targetYearId,
            incomeItemId: s.incomeItemId,
            expenseItemId: s.expenseItemId,
            destId: s.destId,
            destType: s.destType,
            destName: s.destName,
            percentage: s.percentage
        }));

        await prisma.distributionSetting.createMany({
            data: newSettings
        });

        res.json({ message: 'Duplication successful', count: newSettings.length });
    } catch (error) {
        console.error(`[Duplication Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// --- BUDGET REQUESTS & REPORTS ---
router.get('/clean-duplicates', async (req, res) => {
    try {
        const settings = await getPrisma(req).distributionSetting.findMany();
        
        // Group by Unit + IncomeItem + ExpenseItem + DestId
        const groups = {};
        for (const s of settings) {
            const key = `${s.unitId}-${s.incomeItemId}-${s.expenseItemId}-${s.destId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        }

        let deletedCount = 0;
        const toDeleteIds = [];

        for (const key in groups) {
            const items = groups[key];
            if (items.length > 1) {
                const keep = items[items.length - 1];
                for (let i = 0; i < items.length - 1; i++) {
                    toDeleteIds.push(items[i].id);
                }
            }
        }

        if (toDeleteIds.length > 0) {
            const result = await getPrisma(req).distributionSetting.deleteMany({
                where: { id: { in: toDeleteIds } }
            });
            res.json({ message: `Berhasil menghapus ${result.count} data duplikat!`, deletedIds: toDeleteIds });
        } else {
            res.json({ message: "Tidak ada duplikasi yang ditemukan. Data sudah bersih." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/clean-student-duplicates', async (req, res) => {
    try {
        const students = await getPrisma(req).student.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'asc' }
        });
        
        const groups = {};
        for (const s of students) {
            const key = `${s.name.toLowerCase().trim()}-${s.nis || ''}-${s.classId || ''}-${s.unitId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        }

        const toDeleteIds = [];
        let dupesFound = 0;

        for (const key in groups) {
            const items = groups[key];
            if (items.length > 1) {
                // Keep the first one (oldest), delete the rest
                for (let i = 1; i < items.length; i++) {
                    toDeleteIds.push(items[i].id);
                    dupesFound++;
                }
            }
        }

        if (toDeleteIds.length > 0) {
            await getPrisma(req).studentIncomeDetail.deleteMany({
                where: { studentId: { in: toDeleteIds } }
            });
            await getPrisma(req).student.deleteMany({
                where: { id: { in: toDeleteIds } }
            });
            res.json({ message: `Berhasil menghapus ${dupesFound} data siswa duplikat!`, deletedIds: toDeleteIds });
        } else {
            res.json({ message: "Tidak ada duplikasi siswa yang ditemukan. Data sudah bersih." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/budget-requests', async (req, res) => {
    try {
        const requests = await getPrisma(req).budgetRequest.findMany({
            where: { isDeleted: false },
            include: { expenseItem: true, reports: true }
        });
        res.json({ data: requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to create or update transfer journal for approved budget request
async function syncBudgetRequestTransferJournal(prisma, request, reqBody = {}) {
    try {
        if (!request || request.status !== 'APPROVED') return;

        const totalNominal = parseFloat(request.totalAmount || 0);
        if (totalNominal <= 0) return;

        const sourceId = reqBody.sourceBankAccountId || request.sourceBankAccountId;
        const targetId = reqBody.targetUnitBankAccountId || reqBody.creditAccountId || request.targetUnitBankAccountId || request.creditAccountId;
        const isBos = request.source === 'BOS' || (request.items && JSON.stringify(request.items).includes('-BOS'));

        let sourceAcc = sourceId ? await prisma.account.findUnique({ where: { id: sourceId } }) : null;
        if (sourceAcc && (sourceAcc.code.startsWith('1-114') || sourceAcc.name.toLowerCase().includes('kas unit') || sourceId === targetId)) {
            sourceAcc = null;
        }
        if (!sourceAcc) {
            sourceAcc = await prisma.account.findFirst({
                where: {
                    isDeleted: false,
                    isParent: false,
                    OR: isBos 
                        ? [{ code: '1-1112' }, { name: { contains: 'BOS' } }, { name: { contains: 'Dana Terikat' } }]
                        : [{ code: '1-1111' }, { code: '1-1101' }, { name: { contains: 'Yayasan' } }, { name: { contains: 'BSI' } }]
                }
            });
        }

        let targetAcc = targetId ? await prisma.account.findUnique({ where: { id: targetId } }) : null;
        if (!targetAcc) {
            let unitObj = request.unitId ? await prisma.unit.findUnique({ where: { id: request.unitId } }) : null;
            let fieldObj = request.fieldId ? await prisma.field.findUnique({ where: { id: request.fieldId } }) : null;
            const uName = (unitObj?.name || fieldObj?.name || '').trim();
            if (uName) {
                targetAcc = await prisma.account.findFirst({
                    where: {
                        isDeleted: false,
                        isParent: false,
                        name: { contains: uName }
                    }
                });
            }
        }
        if (!targetAcc) {
            targetAcc = await prisma.account.findFirst({
                where: {
                    isDeleted: false,
                    isParent: false,
                    id: { not: sourceAcc?.id },
                    OR: [{ code: { startsWith: '1-11' } }, { type: 'Aset' }]
                }
            });
        }

        if (sourceAcc && targetAcc) {
            const isSourceUnit = (sourceAcc.code?.startsWith('1-114') || sourceAcc.code?.startsWith('1-115') || sourceAcc.name?.toLowerCase().includes('kas unit'));
            const isTargetYayasan = (targetAcc.code?.startsWith('1-110') || targetAcc.code?.startsWith('1-111') || targetAcc.name?.toLowerCase().includes('yayasan') || targetAcc.name?.toLowerCase().includes('bsi'));
            if (isSourceUnit && isTargetYayasan) {
                const temp = sourceAcc;
                sourceAcc = targetAcc;
                targetAcc = temp;
            }
        }

        const transferRef = `TRF-${request.id}`;

        if (sourceAcc && targetAcc) {
            const existingTransferJournal = await prisma.journal.findFirst({
                where: { reference: transferRef, isDeleted: false }
            });

            const targetUnitName = request.unitId ? (await prisma.unit.findUnique({ where: { id: request.unitId } }))?.name : '';
            const targetFieldName = request.fieldId ? (await prisma.field.findUnique({ where: { id: request.fieldId } }))?.name : '';
            const entityName = targetUnitName || targetFieldName || 'Unit';

            const journalPayload = {
                date: request.date ? new Date(request.date) : new Date(),
                name: `Pencairan Permintaan Dana - ${entityName} - ${request.month || '-'}`,
                description: `Pemindahbukuan kas pencairan dana permintaan dari ${sourceAcc.name} ke ${targetAcc.name}`,
                reference: transferRef,
                proof: `REQ-${request.id}`,
                programId: 'PRG-GEN',
                entries: [
                    {
                        accountId: targetAcc.id,
                        accountName: `${targetAcc.code} - ${targetAcc.name}`,
                        debit: totalNominal,
                        credit: 0
                    },
                    {
                        accountId: sourceAcc.id,
                        accountName: `${sourceAcc.code} - ${sourceAcc.name}`,
                        debit: 0,
                        credit: totalNominal
                    }
                ]
            };

            if (existingTransferJournal) {
                await prisma.journal.update({
                    where: { id: existingTransferJournal.id },
                    data: journalPayload
                });
            } else {
                const createdJournal = await prisma.journal.create({
                    data: journalPayload
                });
                if (!request.transferJournalId) {
                    await prisma.budgetRequest.update({
                        where: { id: request.id },
                        data: { transferJournalId: createdJournal.id }
                    }).catch(() => {});
                }
            }
            console.log(`[API] Successfully created/updated transfer journal ${transferRef} for BudgetRequest ${request.id}`);
        }
    } catch (journalErr) {
        console.error(`[API Error] Failed to sync transfer journal for BudgetRequest ${request?.id}:`, journalErr.message);
    }
}

// Helper to resolve Kas Operasional Unit cleanly by Unit ID or Name
async function resolveUnitKasAccount(prisma, unitId) {
    if (!unitId || unitId === 'FOUNDATION' || unitId === 'YAYASAN') return null;
    const UNIT_KAS_CODES = {
        'a8ada0ad-5b27-487c-9448-dfeb34f93761': '1-1142', // SDIT 1
        'mny1yb4u91eun': '1-1143',                         // TKIT 1
        'mo7xk4tfhzmqk': '1-1150',                         // SDIT 2
        'mo7xyewb1btcu': '1-1151',                         // SDIT 3
        'mo7z16fiq1hja': '1-1152',                         // TKIT 2
        'mo7z1fed83f1k': '1-1153',                         // TKIT 3
        'mo7z3mschpyed': '1-1144',                         // TAUD
        'mo7zeqb1gtuh9': '1-1145',                         // MIT
        'mo80p9qllp9ko': '1-1141',                         // SMPIT PDG
        'mo80r64xxxcep': '1-1140',                         // SMAIT
        'mo82mp1zwj0yr': '1-1146',                         // PONPES PUTRA
        'mo84ljcz1maso': '1-1147',                         // PONPES PUTRI
        'mo84m04izb4ls': '1-1148',                         // SMPIT 5O KOTA
        'mqko4qc4kgiru': '1-1149',                         // SDIT 50 KOTA
    };
    if (UNIT_KAS_CODES[unitId]) {
        const acc = await prisma.account.findFirst({
            where: { code: UNIT_KAS_CODES[unitId], isDeleted: false }
        });
        if (acc) return acc;
    }
    const u = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!u) return null;
    const uName = (u.name || '').toLowerCase();
    const allKas = await prisma.account.findMany({
        where: {
            isDeleted: false,
            isParent: false,
            OR: [{ code: { startsWith: '1-114' } }, { code: { startsWith: '1-115' } }, { name: { contains: 'Kas Unit' } }]
        }
    });
    if (uName.includes('50 kota')) {
        if (uName.includes('smp')) return allKas.find(a => a.code === '1-1148') || null;
        if (uName.includes('sd')) return allKas.find(a => a.code === '1-1149') || null;
    }
    if (uName.includes('tkit 2') || uName.includes('tk 2')) return allKas.find(a => a.code === '1-1152') || null;
    if (uName.includes('tkit 3') || uName.includes('tk 3')) return allKas.find(a => a.code === '1-1153') || null;
    if (uName.includes('tkit') || uName.includes('tk')) return allKas.find(a => a.code === '1-1143') || null;
    if (uName.includes('sdit 2') || uName.includes('sd 2')) return allKas.find(a => a.code === '1-1150') || null;
    if (uName.includes('sdit 3') || uName.includes('sd 3')) return allKas.find(a => a.code === '1-1151') || null;
    if (uName.includes('sdit') || uName.includes('sd')) return allKas.find(a => a.code === '1-1142') || null;
    if (uName.includes('smp')) return allKas.find(a => a.code === '1-1141') || null;
    if (uName.includes('sma')) return allKas.find(a => a.code === '1-1140') || null;
    if (uName.includes('putra') || uName.includes('pondok putra')) return allKas.find(a => a.code === '1-1146') || null;
    if (uName.includes('putri') || uName.includes('pondok putri')) return allKas.find(a => a.code === '1-1147') || null;
    if (uName.includes('taud')) return allKas.find(a => a.code === '1-1144') || null;
    if (uName.includes('mit')) return allKas.find(a => a.code === '1-1145') || null;
    return null;
}

// Helper to resolve debit & credit accounts for Pengembalian Dana (Refund)
// Rules:
// DEBIT: Rekening Bank Yayasan / Penampung (misal rek TK 91: 1-1114 BSI 55-91)
// KREDIT: Kas Operasional Unit (misal Kas Unit TKIT: 1-1143)
async function resolveRefundAccounts(prisma, report, budgetRequest = null) {
    let req = budgetRequest;
    if (!req && report.budgetRequestId) {
        req = await prisma.budgetRequest.findUnique({ where: { id: report.budgetRequestId } });
    }
    const unitId = report.unitId || req?.unitId;

    let yayasanBankAcc = null;
    let unitKasAcc = null;

    // 1. Check from parent budget request accounts
    if (req) {
        const candidateIds = [req.sourceBankAccountId, req.targetUnitBankAccountId, req.creditAccountId].filter(Boolean);
        for (const cid of candidateIds) {
            const acc = await prisma.account.findUnique({ where: { id: cid } });
            if (!acc) continue;
            if (acc.code.startsWith('1-114') || acc.code.startsWith('1-115') || acc.name.toLowerCase().includes('kas unit')) {
                if (!unitKasAcc) unitKasAcc = acc;
            } else if (acc.code.startsWith('1-111') || acc.code.startsWith('1-110') || acc.code.startsWith('1-112') || acc.code.startsWith('1-113') || acc.name.toLowerCase().includes('bsi') || acc.name.toLowerCase().includes('nagari') || acc.name.toLowerCase().includes('bank')) {
                if (!yayasanBankAcc) yayasanBankAcc = acc;
            }
        }
    }

    // 2. Resolve Kas Operasional Unit if not found
    if (!unitKasAcc && unitId) {
        unitKasAcc = await resolveUnitKasAccount(prisma, unitId);
    }

    // 3. Resolve Bank Yayasan / Rekening Unit if not found
    if (!yayasanBankAcc && unitId) {
        const u = await prisma.unit.findUnique({ where: { id: unitId } });
        const uName = (u?.name || '').toLowerCase();
        const allBanks = await prisma.account.findMany({
            where: {
                isDeleted: false,
                isParent: false,
                OR: [{ code: { startsWith: '1-111' } }, { code: { startsWith: '1-110' } }, { code: { startsWith: '1-112' } }, { code: { startsWith: '1-113' } }]
            }
        });

        if (uName.includes('tk') || uName.includes('tkit')) {
            yayasanBankAcc = allBanks.find(a => a.code === '1-1114') || allBanks.find(a => a.name.toLowerCase().includes('spp tk'));
        } else if (uName.includes('sd') || uName.includes('sdit')) {
            yayasanBankAcc = allBanks.find(a => a.code === '1-1107') || allBanks.find(a => a.name.toLowerCase().includes('spp sd'));
        } else if (uName.includes('smp') || uName.includes('smpit')) {
            yayasanBankAcc = allBanks.find(a => a.code === '1-1109') || allBanks.find(a => a.name.toLowerCase().includes('spp smp'));
        } else if (uName.includes('taud')) {
            yayasanBankAcc = allBanks.find(a => a.code === '1-1118') || allBanks.find(a => a.name.toLowerCase().includes('taud'));
        } else if (uName.includes('mit')) {
            yayasanBankAcc = allBanks.find(a => a.code === '1-1119') || allBanks.find(a => a.name.toLowerCase().includes('mit'));
        }

        if (!yayasanBankAcc) {
            yayasanBankAcc = allBanks.find(a => uName && a.name.toLowerCase().includes(uName)) ||
                             allBanks.find(a => a.code === '1-1111') ||
                             allBanks.find(a => a.code === '1-1101') || null;
        }
    }

    return {
        debitAccount: yayasanBankAcc,
        creditAccount: unitKasAcc
    };
}

// Helper to cascade sync existing budget reports and their journals when BudgetRequest COA changes
async function syncLinkedBudgetReportsJournals(prisma, request) {
    try {
        if (!request || !request.id) return;

        const items = Array.isArray(request.items) 
            ? request.items 
            : (typeof request.items === 'string' ? JSON.parse(request.items) : []);

        // Find all linked reports for this request
        const linkedReports = await prisma.budgetReport.findMany({
            where: {
                budgetRequestId: request.id,
                isDeleted: false
            }
        });

        if (linkedReports.length === 0) return;

        console.log(`[API] Syncing COA & journals for ${linkedReports.length} reports linked to BudgetRequest ${request.id}`);

        for (const report of linkedReports) {
            let debitId = '';
            let creditId = '';
            let debitAcc = null;
            let creditAcc = null;

            if (report.kategoriAset === 'PENGEMBALIAN') {
                // Pengembalian sisa dana kas unit ke Yayasan:
                // DEBIT: Rekening Bank Yayasan (rek TK 91 / BSI unit penampung)
                // KREDIT: Kas Operasional Unit (Kas Unit TKIT 1)
                const refundAccounts = await resolveRefundAccounts(prisma, report, request);
                debitAcc = refundAccounts.debitAccount;
                creditAcc = refundAccounts.creditAccount;
                debitId = debitAcc?.id || '';
                creditId = creditAcc?.id || '';
                if (!debitId && !creditId) continue;
            } else {
                let matchedItem = null;
                if (items && items.length > 0) {
                    if (report.planId) {
                        matchedItem = items.find(i => (i.componentId && i.componentId === report.planId) || (i.id && i.id === report.planId));
                    }
                    const repCat = (report.category || '').trim().toLowerCase();
                    const repDesc = (report.description || '').trim().toLowerCase();
                    if (!matchedItem && repCat) {
                        matchedItem = items.find(i => i.name && i.name.trim().toLowerCase() === repCat);
                    }
                    if (!matchedItem && repDesc) {
                        matchedItem = items.find(i => i.name && i.name.trim().toLowerCase() === repDesc);
                    }
                    if (!matchedItem && repCat) {
                        matchedItem = items.find(i => i.name && (repCat.includes(i.name.trim().toLowerCase()) || i.name.trim().toLowerCase().includes(repCat)));
                    }
                    if (!matchedItem && repDesc) {
                        matchedItem = items.find(i => i.name && (repDesc.includes(i.name.trim().toLowerCase()) || i.name.trim().toLowerCase().includes(repDesc)));
                    }
                    if (!matchedItem && report.expenseItemId) {
                        const sameExp = items.filter(i => i.expenseItemId === report.expenseItemId || i.componentId === report.expenseItemId);
                        if (sameExp.length > 0) matchedItem = sameExp[0];
                    }
                    if (!matchedItem && items.length === 1) {
                        matchedItem = items[0];
                    }
                }

                debitId = matchedItem?.debitAccountId || '';
                creditId = matchedItem?.creditAccountId || request.targetUnitBankAccountId || '';
                if (!creditId && report.unitId && report.unitId !== 'FOUNDATION' && report.unitId !== 'YAYASAN') {
                    const uKas = await resolveUnitKasAccount(prisma, report.unitId);
                    if (uKas) creditId = uKas.id;
                }
                if (!creditId) {
                    creditId = request.creditAccountId || '';
                }

                if (!debitId && !creditId) continue;

                debitAcc = debitId ? await prisma.account.findUnique({ where: { id: debitId } }) : null;
                creditAcc = creditId ? await prisma.account.findUnique({ where: { id: creditId } }) : null;
            }

            // Update linked journal
            let targetJournal = null;
            if (report.journalId) {
                targetJournal = await prisma.journal.findUnique({ where: { id: report.journalId } });
            }
            if (!targetJournal) {
                const possibleRefs = [
                    report.nomorNota,
                    report.planId,
                    `REPORT-${report.id.substring(0, 8)}`,
                    `RET-${report.id}`
                ].filter(Boolean);
                targetJournal = await prisma.journal.findFirst({
                    where: {
                        isDeleted: false,
                        OR: possibleRefs.map(r => ({ reference: r }))
                    }
                });
            }

            if (targetJournal && targetJournal.entries) {
                const entries = typeof targetJournal.entries === 'string' 
                    ? JSON.parse(targetJournal.entries) 
                    : targetJournal.entries;
                
                const amount = parseFloat(report.amount || targetJournal.entries?.[0]?.debit || 0);

                const newEntries = [
                    {
                        accountId: debitId || entries[0]?.accountId || '',
                        accountName: debitAcc ? `${debitAcc.code} - ${debitAcc.name}` : (entries[0]?.accountName || 'Debit'),
                        debit: amount,
                        credit: 0
                    },
                    {
                        accountId: creditId || entries[1]?.accountId || '',
                        accountName: creditAcc ? `${creditAcc.code} - ${creditAcc.name}` : (entries[1]?.accountName || 'Kas / Bank'),
                        debit: 0,
                        credit: amount
                    }
                ];

                await prisma.journal.update({
                    where: { id: targetJournal.id },
                    data: { entries: newEntries }
                });

                if (!report.journalId) {
                    await prisma.budgetReport.update({
                        where: { id: report.id },
                        data: { journalId: targetJournal.id }
                    });
                }
            }
        }
    } catch (err) {
        console.error(`[API Error] Failed to cascade sync budget report journals for BudgetRequest ${request?.id}:`, err.message);
    }
}

router.post('/budget-requests', async (req, res) => {
    try {
        const ALLOWED_FIELDS = ['id', 'status', 'description', 'month', 'year',
            'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
            'date', 'expenseItemId', 'isDeleted', 'source', 'notified', 'isClosed',
            'creditAccountId', 'sourceBankAccountId', 'targetUnitBankAccountId', 'transferJournalId'];

        const data = {};
        ALLOWED_FIELDS.forEach(f => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        if (data.date) data.date = new Date(data.date);
        if (data.totalAmount !== undefined && data.totalAmount !== null) data.totalAmount = parseFloat(data.totalAmount);
        if (data.amount !== undefined && data.amount !== null) data.amount = parseFloat(data.amount);

        const request = await getPrisma(req).budgetRequest.create({ data });

        if (request.status === 'APPROVED') {
            await syncBudgetRequestTransferJournal(getPrisma(req), request, req.body);
        }

        recordAudit(getPrisma(req), {
            req,
            action: 'CREATE',
            entity: 'PermintaanDana',
            entityId: request.id,
            unitId: request.unitId,
            fieldId: request.fieldId,
            details: {
                month: request.month,
                totalAmount: request.totalAmount,
                itemCount: Array.isArray(request.items) ? request.items.length : 0,
                message: `Mengajukan Permintaan Dana bulan ${request.month || '-'} sebesar Rp ${Math.round(request.totalAmount || 0).toLocaleString('id-ID')}`
            }
        }).catch(() => {});
        res.json({ data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/budget-requests/:id', async (req, res) => {
    try {
        // Only pick fields that exist in the Prisma BudgetRequest schema
        // Sending unknown fields (e.g. approvedAt, rejectedAt) causes Prisma to throw
        const ALLOWED_FIELDS = ['status', 'description', 'month', 'year',
            'totalAmount', 'amount', 'items', 'unitId', 'fieldId', 'academicYearId',
            'date', 'expenseItemId', 'isDeleted', 'source', 'notified', 'isClosed',
            'creditAccountId', 'sourceBankAccountId', 'targetUnitBankAccountId', 'transferJournalId'];

        const data = {};
        ALLOWED_FIELDS.forEach(f => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        if (data.date) data.date = new Date(data.date);
        if (data.totalAmount !== undefined && data.totalAmount !== null) data.totalAmount = parseFloat(data.totalAmount);
        if (data.amount !== undefined && data.amount !== null) data.amount = parseFloat(data.amount);

        console.log(`[API] Updating BudgetRequest ${req.params.id} → status: ${data.status}`);

        const prisma = getPrisma(req);
        
        // Load the existing request first
        const existing = await prisma.budgetRequest.findUnique({
            where: { id: req.params.id }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Pengajuan dana tidak ditemukan.' });
        }

        // Check for bypass balance check (emergency override by Super Admin)
        const bypassBalanceCheck = data.bypassBalanceCheck === true;
        delete data.bypassBalanceCheck;

        // Enforce unreturned balance check when status is transitioning to APPROVED
        if (data.status === 'APPROVED' && existing.status !== 'APPROVED' && !bypassBalanceCheck) {
            const unitId = data.unitId !== undefined ? data.unitId : existing.unitId;
            const fieldId = data.fieldId !== undefined ? data.fieldId : existing.fieldId;
            const academicYearId = data.academicYearId !== undefined ? data.academicYearId : existing.academicYearId;
            const month = data.month !== undefined ? data.month : existing.month;
            const reqSource = (data.source !== undefined ? data.source : existing.source) || 'YAYASAN';
            const isTargetBos = reqSource === 'BOS';

            if (month) {
                // Find all approved requests in the same academic year for prior months matching the source
                const priorRequests = await prisma.budgetRequest.findMany({
                    where: {
                        unitId: unitId || null,
                        fieldId: fieldId || null,
                        academicYearId: academicYearId,
                        status: 'APPROVED',
                        isDeleted: false,
                        month: { lt: month },
                        ...(isTargetBos ? { source: 'BOS' } : { OR: [{ source: 'YAYASAN' }, { source: null }] })
                    }
                });

                if (priorRequests.length > 0) {
                    const totalCair = priorRequests.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
                    
                    const priorRequestIds = priorRequests.map(r => r.id);
                    const priorReports = await prisma.budgetReport.findMany({
                        where: {
                            budgetRequestId: { in: priorRequestIds },
                            status: 'APPROVED',
                            isDeleted: false,
                            kategoriAset: { not: 'PENGEMBALIAN' }
                        }
                    });
                    const totalUsed = priorReports.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                    const approvedReturns = await prisma.budgetReport.findMany({
                        where: {
                            status: { in: ['APPROVED', 'PENDING'] },
                            isDeleted: false,
                            kategoriAset: 'PENGEMBALIAN',
                            ...(isTargetBos ? { source: 'BOS' } : { OR: [{ source: 'YAYASAN' }, { source: null }] }),
                            OR: [
                                { budgetRequestId: { in: priorRequestIds } },
                                {
                                    academicYearId: academicYearId,
                                    ...(fieldId ? { fieldId: fieldId } : (unitId ? { unitId: unitId } : {}))
                                }
                            ]
                        }
                    });
                    const totalReturned = approvedReturns.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                    const unreturned = totalCair - totalUsed - totalReturned;
                    if (unreturned > 100) {
                        return res.status(400).json({
                            error: `Pencairan ditangguhkan: Unit/Bidang memiliki sisa saldo dana ${isTargetBos ? 'BOS' : 'Yayasan'} dari bulan sebelumnya yang belum dikembalikan sebesar Rp ${Math.round(unreturned).toLocaleString('id-ID')}. Harap kembalikan sisa saldo terlebih dahulu.`
                        });
                    }
                }
            }
        }

        const request = await prisma.budgetRequest.update({
            where: { id: req.params.id },
            data
        });

        // Auto-journaling for Transfer Kas when status is APPROVED or remains APPROVED
        if (data.status === 'APPROVED' || existing.status === 'APPROVED') {
            await syncBudgetRequestTransferJournal(prisma, request, req.body);
            await syncLinkedBudgetReportsJournals(prisma, request);
        } else if (data.status === 'REJECTED') {
            await prisma.journal.updateMany({
                where: { reference: `TRF-${req.params.id}` },
                data: { isDeleted: true }
            }).catch(() => {});
        }

        const actionType = data.status === 'APPROVED' ? 'APPROVE' : (data.status === 'REJECTED' ? 'REJECT' : 'UPDATE');
        recordAudit(prisma, {
            req,
            action: actionType,
            entity: 'PermintaanDana',
            entityId: req.params.id,
            unitId: request.unitId,
            fieldId: request.fieldId,
            details: {
                status: data.status,
                totalAmount: request.totalAmount,
                month: request.month,
                message: actionType === 'APPROVE'
                    ? `Menyetujui Permintaan Dana bulan ${request.month || '-'} sebesar Rp ${Math.round(request.totalAmount || 0).toLocaleString('id-ID')}`
                    : (actionType === 'REJECT' ? `Menolak Permintaan Dana bulan ${request.month || '-'}` : `Memperbarui status/data Permintaan Dana bulan ${request.month || '-'}`)
            }
        }).catch(() => {});
        res.json({ data: request });
    } catch (error) {
        console.error(`[API Error] PUT /budget-requests/${req.params.id}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/budget-requests/:id', requireAuth, async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const reqId = req.params.id;

        // Ambil data pengajuan terlebih dahulu untuk divalidasi
        const budgetReq = await prisma.budgetRequest.findUnique({
            where: { id: reqId }
        });

        if (!budgetReq) {
            return res.status(404).json({ error: 'Pengajuan dana tidak ditemukan.' });
        }

        // Cek wewenang jika bukan superadmin
        if (req.user.role !== 'superadmin') {
            let userUnitId = req.user.unitId;
            let userFieldId = req.user.fieldId;

            // Always load from DB to get fresh unitId/fieldId (handles old tokens with null/undefined)
            // This ensures correctness regardless of token age/format
            try {
                const dbUser = await prisma.user.findUnique({
                    where: { id: req.user.id }
                });
                if (dbUser) {
                    userUnitId = dbUser.unitId || userUnitId;
                    userFieldId = dbUser.fieldId || userFieldId;
                }
            } catch (dbErr) {
                console.warn('[DELETE /budget-requests] DB user lookup failed, using JWT values:', dbErr.message);
            }

            console.log(`[DELETE /budget-requests/${reqId}] user.id=${req.user.id}, userUnitId=${userUnitId}, userFieldId=${userFieldId}, budgetReq.unitId=${budgetReq.unitId}, budgetReq.fieldId=${budgetReq.fieldId}`);

            const isOwner = (userUnitId && budgetReq.unitId === userUnitId) ||
                            (userFieldId && budgetReq.fieldId === userFieldId);

            if (!isOwner) {
                return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki wewenang untuk membatalkan pengajuan ini.' });
            }

            // Hanya pengajuan berstatus PENDING atau DRAFT yang boleh dibatalkan oleh unit/bidang
            if (budgetReq.status !== 'PENDING' && budgetReq.status !== 'DRAFT') {
                return res.status(400).json({ error: 'Gagal membatalkan: Pengajuan sudah disetujui atau ditolak.' });
            }
        }

        const isPermanent = req.query.permanent === 'true';
        if (isPermanent) {
            await prisma.budgetRequest.delete({ where: { id: reqId } });
            await prisma.journal.deleteMany({ where: { reference: `TRF-${reqId}` } }).catch(() => {});
        } else {
            await prisma.budgetRequest.update({
                where: { id: reqId },
                data: { isDeleted: true }
            });
            await prisma.journal.updateMany({
                where: { reference: `TRF-${reqId}` },
                data: { isDeleted: true }
            }).catch(() => {});
        }
        recordAudit(prisma, {
            req,
            action: 'DELETE',
            entity: 'PermintaanDana',
            entityId: reqId,
            unitId: budgetReq.unitId,
            fieldId: budgetReq.fieldId,
            details: {
                month: budgetReq.month,
                totalAmount: budgetReq.totalAmount,
                isPermanent,
                message: `Membatalkan/menghapus pengajuan dana bulan ${budgetReq.month || '-'} sebesar Rp ${Math.round(budgetReq.totalAmount || 0).toLocaleString('id-ID')}`
            }
        }).catch(() => {});
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/budget-reports', async (req, res) => {
    try {
        const {
            id, budgetRequestId, amount, description, date, expenseItemId,
            unitId, fieldId, academicYearId, category,
            buktiTeks, buktiFoto, nomorNota, volume, satuan, harga, diskon, kategoriAset, umurEkonomis, namaAset, assetName, status, planId, source
        } = req.body;
        const prisma = getPrisma(req);

        const result = await prisma.$transaction(async (tx) => {
            let actualExpenseItemId = expenseItemId;
            let effectiveFieldId = fieldId || null;
            let effectiveUnitId = unitId || null;
            let effectiveAcademicYearId = academicYearId || null;
            let effectivePlanId = planId || null;

            if (budgetRequestId) {
                const breq = await tx.budgetRequest.findUnique({ where: { id: budgetRequestId } });
                if (breq) {
                    if (!actualExpenseItemId && breq.expenseItemId) {
                        actualExpenseItemId = breq.expenseItemId;
                    }
                    if (!effectiveFieldId && breq.fieldId) {
                        effectiveFieldId = breq.fieldId;
                    }
                    if (!effectiveUnitId && breq.unitId) {
                        effectiveUnitId = breq.unitId;
                    }
                    if (!effectiveAcademicYearId && breq.academicYearId) {
                        effectiveAcademicYearId = breq.academicYearId;
                    }
                    if (!effectivePlanId && breq.planId) {
                        effectivePlanId = breq.planId;
                    }
                }
            }

            let calculatedHarga = (harga !== undefined && harga !== null && harga !== '') ? parseFloat(harga) : null;
            const parsedVol = volume ? parseFloat(volume) : 1;
            const parsedAmt = amount ? parseFloat(amount) : null;
            if ((calculatedHarga === null || calculatedHarga <= 0) && parsedAmt && parsedVol > 0) {
                calculatedHarga = Math.round(parsedAmt / parsedVol);
            }

            // 1. Create Report with all fields
            const report = await tx.budgetReport.create({
                data: {
                    id: id || undefined,
                    budgetRequestId: budgetRequestId || null,
                    amount: parsedAmt,
                    description: description || null,
                    date: parseSafeDate(date),
                    expenseItemId: actualExpenseItemId || null,
                    unitId: effectiveUnitId,
                    fieldId: effectiveFieldId,
                    academicYearId: effectiveAcademicYearId,
                    category: category || null,
                    source: source || null,
                    // New fields
                    buktiTeks: buktiTeks || null,
                    buktiFoto: buktiFoto || null,
                    nomorNota: nomorNota || null,
                    volume: volume ? parseFloat(volume) : null,
                    satuan: satuan || null,
                    harga: calculatedHarga,
                    diskon: diskon ? parseFloat(diskon) : null,
                    kategoriAset: kategoriAset || 'NON_ASET',
                    umurEkonomis: umurEkonomis ? parseInt(umurEkonomis) : null,
                    namaAset: namaAset || assetName || null,
                    status: status || 'PENDING',
                    planId: planId || null,
                }
            });

            // 2. Fetch Expense Item to get Account Mapping
            let expenseItem = null;
            if (actualExpenseItemId) {
                expenseItem = await tx.expenseItem.findUnique({
                    where: { id: actualExpenseItemId },
                    include: { unit: true }
                });
            }

            // 3. Create Journal Entry (Only if report status is APPROVED)
            if (status === 'APPROVED') {
                let targetName = 'Yayasan';
                if (unitId) {
                    const u = await tx.unit.findUnique({ where: { id: unitId } });
                    if (u) targetName = u.name;
                } else if (fieldId) {
                    const f = await tx.field.findUnique({ where: { id: fieldId } });
                    if (f) targetName = f.name;
                }

                let resolvedProgramId = null;
                let journalDescription = '';

                // Look up matching ExpenseProgram by category or description
                let expenseProgram = null;
                if (category) {
                    expenseProgram = await tx.expenseProgram.findFirst({
                        where: { name: category, isDeleted: false }
                    });
                }
                if (!expenseProgram && description) {
                    expenseProgram = await tx.expenseProgram.findFirst({
                        where: { name: description, isDeleted: false }
                    });
                }
                
                if (kategoriAset === 'PENGEMBALIAN') {
                    const isBos = source === 'BOS' || (planId && planId.endsWith('-BOS'));
                    journalDescription = isBos
                        ? `Pengembalian Sisa Dana BOS: ${targetName}${description ? ` (${description})` : ''}`
                        : `Pengembalian Sisa Dana: ${targetName}${description ? ` (${description})` : ''}`;
                    resolvedProgramId = 'PRG-GEN';
                } else {
                    const expName = expenseProgram?.name || expenseItem?.name || description || 'Pengeluaran';
                    journalDescription = `Realisasi: ${expName} - ${targetName}${description ? ` (${description})` : ''}`;
                    if (category) {
                        const p = await tx.program.findFirst({
                            where: { category: category, isDeleted: false }
                        });
                        if (p) resolvedProgramId = p.id;
                    }
                }

                // Resolve Debit & Credit Accounts:
                // Priority 1: Check if parent BudgetRequest has predefined COAs for this item
                let reqDebitId = '';
                let reqCreditId = '';
                if (budgetRequestId) {
                    const parentReq = await tx.budgetRequest.findUnique({ where: { id: budgetRequestId } });
                    if (parentReq && parentReq.items) {
                        const bItems = Array.isArray(parentReq.items) ? parentReq.items : (typeof parentReq.items === 'string' ? JSON.parse(parentReq.items) : []);
                        let matchedItem = null;
                        if (planId) {
                            matchedItem = bItems.find(i => (i.componentId && i.componentId === planId) || (i.id && i.id === planId));
                        }
                        const repCat = (category || '').trim().toLowerCase();
                        const repDesc = (description || '').trim().toLowerCase();
                        if (!matchedItem && repCat) {
                            matchedItem = bItems.find(i => i.name && i.name.trim().toLowerCase() === repCat);
                        }
                        if (!matchedItem && repDesc) {
                            matchedItem = bItems.find(i => i.name && i.name.trim().toLowerCase() === repDesc);
                        }
                        if (!matchedItem && repCat) {
                            matchedItem = bItems.find(i => i.name && (repCat.includes(i.name.trim().toLowerCase()) || i.name.trim().toLowerCase().includes(repCat)));
                        }
                        if (!matchedItem && repDesc) {
                            matchedItem = bItems.find(i => i.name && (repDesc.includes(i.name.trim().toLowerCase()) || i.name.trim().toLowerCase().includes(repDesc)));
                        }
                        if (!matchedItem && actualExpenseItemId) {
                            const sameExp = bItems.filter(i => i.expenseItemId === actualExpenseItemId || i.componentId === actualExpenseItemId);
                            if (sameExp.length > 0) matchedItem = sameExp[0];
                        }
                        if (!matchedItem && bItems.length === 1) {
                            matchedItem = bItems[0];
                        }
                        if (matchedItem) {
                            if (matchedItem.debitAccountId) reqDebitId = matchedItem.debitAccountId;
                            if (matchedItem.creditAccountId) reqCreditId = matchedItem.creditAccountId;
                        }
                        if (!reqCreditId && (parentReq.targetUnitBankAccountId || parentReq.creditAccountId)) {
                            reqCreditId = parentReq.targetUnitBankAccountId || parentReq.creditAccountId;
                        }
                    }
                }

                let debitAccount = '';
                let creditAccount = '';
                let debitName = '';
                let creditName = '';

                if (kategoriAset === 'PENGEMBALIAN') {
                    const refundAccounts = await resolveRefundAccounts(tx, report, budgetRequestId ? await tx.budgetRequest.findUnique({ where: { id: budgetRequestId } }) : null);
                    const dAcc = refundAccounts.debitAccount;
                    const cAcc = refundAccounts.creditAccount;
                    debitAccount = dAcc?.id || '';
                    creditAccount = cAcc?.id || '';
                    debitName = dAcc ? `${dAcc.code} - ${dAcc.name}` : 'Rekening Bank Yayasan (Debit)';
                    creditName = cAcc ? `${cAcc.code} - ${cAcc.name}` : 'Kas Unit (Kredit)';
                } else {
                    // Priority 2: ExpenseProgram or ExpenseItem
                    let resolvedDebitId = reqDebitId || expenseProgram?.debitAccountId || expenseItem?.debitAccountId || expenseItem?.accountId || '';
                    let resolvedCreditId = reqCreditId || expenseProgram?.creditAccountId || expenseItem?.creditAccountId || '';

                    // Fallback for Credit (Kas/Bank) if still empty:
                    if (!resolvedCreditId) {
                        const isBos = source === 'BOS' || (planId && planId.endsWith('-BOS')) || (category && category.trim().toUpperCase() === 'BOS');
                        if (isBos) {
                            const bosBank = await tx.account.findFirst({
                                where: { isDeleted: false, isParent: false, OR: [{ code: '1-1112' }, { name: { contains: 'BOS' } }] }
                            });
                            if (bosBank) resolvedCreditId = bosBank.id;
                        } else if (unitId && unitId !== 'FOUNDATION' && unitId !== 'YAYASAN') {
                            const unitKas = await resolveUnitKasAccount(tx, unitId);
                            if (unitKas) resolvedCreditId = unitKas.id;
                        } else {
                            const yayasanKas = await tx.account.findFirst({
                                where: { isDeleted: false, isParent: false, OR: [{ code: '1-1101' }, { code: '1-1111' }, { name: { contains: 'Kas Yayasan' } }] }
                            });
                            if (yayasanKas) resolvedCreditId = yayasanKas.id;
                        }
                    }

                    let debitAccObj = null;
                    if (resolvedDebitId) {
                        debitAccObj = await tx.account.findUnique({ where: { id: resolvedDebitId } });
                    }

                    let creditAccObj = null;
                    if (resolvedCreditId) {
                        creditAccObj = await tx.account.findUnique({ where: { id: resolvedCreditId } });
                    }

                    debitAccount = resolvedDebitId || '';
                    debitName = debitAccObj 
                        ? `${debitAccObj.code} - ${debitAccObj.name}` 
                        : (resolvedDebitId ? (expenseProgram?.name || expenseItem?.name || 'Debit') : 'MENUNGGU COA (Debit)');
                    
                    creditAccount = resolvedCreditId || '';
                    creditName = creditAccObj 
                        ? `${creditAccObj.code} - ${creditAccObj.name}` 
                        : (resolvedCreditId ? 'Kas / Bank' : 'MENUNGGU COA (Kredit)');
                }

                const journal = await tx.journal.create({
                    data: {
                        date: date ? new Date(date) : new Date(),
                        name: targetName,
                        description: journalDescription,
                        reference: nomorNota || (planId ? planId : `REPORT-${report.id.substring(0, 8)}`),
                        proof: buktiTeks || null,
                        programId: resolvedProgramId,
                        entries: [
                            {
                                accountId: debitAccount,
                                accountName: debitName,
                                debit: parseFloat(amount) || 0,
                                credit: 0
                            },
                            {
                                accountId: creditAccount,
                                accountName: creditName,
                                debit: 0,
                                credit: parseFloat(amount) || 0
                            }
                        ]
                    }
                });

                // Update report with journal info
                await tx.budgetReport.update({
                    where: { id: report.id },
                    data: { journalId: journal.id }
                });
            }

            return report;
        });

        const isRefund = kategoriAset === 'PENGEMBALIAN';
        recordAudit(getPrisma(req), {
            req,
            action: 'CREATE',
            entity: isRefund ? 'PengembalianKas' : 'NotaBelanja',
            entityId: result.id,
            unitId: result.unitId,
            fieldId: result.fieldId,
            details: {
                nomorNota: result.nomorNota,
                amount: result.amount,
                description: result.description,
                buktiTeks: result.buktiTeks,
                status: result.status,
                message: isRefund
                    ? `Mencatat pengembalian kas sisa dana sebesar Rp ${Math.round(result.amount || 0).toLocaleString('id-ID')}`
                    : `Menginput nota belanja No. ${result.nomorNota || '-'} (${result.description || '-'}) sebesar Rp ${Math.round(result.amount || 0).toLocaleString('id-ID')}`
            }
        }).catch(() => {});
        res.json({ data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/budget-reports/:id', async (req, res) => {
    try {
        const ALLOWED_FIELDS = [
            'status', 'amount', 'description', 'date', 'expenseItemId',
            'unitId', 'fieldId', 'academicYearId', 'category', 'source',
            'buktiTeks', 'buktiFoto', 'nomorNota', 'volume', 'satuan', 'harga', 'diskon',
            'kategoriAset', 'umurEkonomis', 'namaAset', 'isDeleted', 'planId', 'budgetRequestId'
        ];

        const data = {};
        ALLOWED_FIELDS.forEach(f => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        if (data.date) data.date = parseSafeDate(data.date);
        if (data.amount !== undefined && data.amount !== null) data.amount = parseFloat(data.amount);
        if (data.volume !== undefined && data.volume !== null) data.volume = parseFloat(data.volume);
        if (data.harga !== undefined && data.harga !== null && data.harga !== '') {
            data.harga = parseFloat(data.harga);
        } else if (data.amount && data.volume && parseFloat(data.volume) > 0) {
            data.harga = Math.round(parseFloat(data.amount) / parseFloat(data.volume));
        }
        if (data.diskon !== undefined && data.diskon !== null) data.diskon = parseFloat(data.diskon);
        if (data.umurEkonomis !== undefined && data.umurEkonomis !== null) data.umurEkonomis = parseInt(data.umurEkonomis);

        console.log(`[API] Updating BudgetReport ${req.params.id} → status: ${data.status}`);

        const prisma = getPrisma(req);
        const report = await prisma.$transaction(async (tx) => {
            const updated = await tx.budgetReport.update({
                where: { id: req.params.id },
                data
            });

            // If APPROVED and no journalId exists, automatically create the journal entry
            if (data.status === 'APPROVED' && !updated.journalId) {
                let expenseItem = null;
                if (updated.expenseItemId) {
                    expenseItem = await tx.expenseItem.findUnique({
                        where: { id: updated.expenseItemId },
                        include: { unit: true }
                    });
                }

                let targetName = 'Yayasan';
                if (updated.unitId) {
                    const u = await tx.unit.findUnique({ where: { id: updated.unitId } });
                    if (u) targetName = u.name;
                } else if (updated.fieldId) {
                    const f = await tx.field.findUnique({ where: { id: updated.fieldId } });
                    if (f) targetName = f.name;
                }

                let resolvedProgramId = null;
                let journalDescription = '';

                // Look up matching ExpenseProgram by category or description
                let expenseProgram = null;
                if (updated.category) {
                    expenseProgram = await tx.expenseProgram.findFirst({
                        where: { name: updated.category, isDeleted: false }
                    });
                }
                if (!expenseProgram && updated.description) {
                    expenseProgram = await tx.expenseProgram.findFirst({
                        where: { name: updated.description, isDeleted: false }
                    });
                }
                
                if (updated.kategoriAset === 'PENGEMBALIAN') {
                    const isBos = updated.source === 'BOS' || (updated.planId && updated.planId.endsWith('-BOS'));
                    journalDescription = isBos
                        ? `Pengembalian Sisa Dana BOS: ${targetName}${updated.description ? ` (${updated.description})` : ''}`
                        : `Pengembalian Sisa Dana: ${targetName}${updated.description ? ` (${updated.description})` : ''}`;
                    resolvedProgramId = 'PRG-GEN';
                } else {
                    const expName = expenseProgram?.name || expenseItem?.name || updated.description || 'Pengeluaran';
                    journalDescription = `Realisasi: ${expName} - ${targetName}${updated.description ? ` (${updated.description})` : ''}`;
                    if (updated.category) {
                        const p = await tx.program.findFirst({
                            where: { category: updated.category, isDeleted: false }
                        });
                        if (p) resolvedProgramId = p.id;
                    }
                }

                // Resolve Debit & Credit Accounts:
                // Priority 1: Check if parent BudgetRequest has predefined COAs for this item (set by Superadmin during request review)
                let reqDebitId = '';
                let reqCreditId = '';

                if (updated.budgetRequestId) {
                    const parentReq = await tx.budgetRequest.findUnique({
                        where: { id: updated.budgetRequestId }
                    });
                    if (parentReq && parentReq.items) {
                        const items = Array.isArray(parentReq.items)
                            ? parentReq.items
                            : (typeof parentReq.items === 'string' ? JSON.parse(parentReq.items) : []);

                        let matchedItem = null;
                        if (updated.planId) {
                            matchedItem = items.find(i => (i.componentId && i.componentId === updated.planId) || (i.planId && i.planId === updated.planId));
                        }
                        if (!matchedItem && updated.expenseItemId) {
                            matchedItem = items.find(i => i.expenseItemId === updated.expenseItemId || i.componentId === updated.expenseItemId);
                        }
                        if (!matchedItem && updated.description) {
                            const d = updated.description.trim().toLowerCase();
                            matchedItem = items.find(i => i.name && i.name.trim().toLowerCase() === d);
                        }
                        if (!matchedItem && items.length === 1) {
                            matchedItem = items[0];
                        }

                        if (matchedItem) {
                            if (matchedItem.debitAccountId) reqDebitId = matchedItem.debitAccountId;
                            if (matchedItem.creditAccountId) reqCreditId = matchedItem.creditAccountId;
                        }
                        if (!reqCreditId && (parentReq.targetUnitBankAccountId || parentReq.creditAccountId)) {
                            reqCreditId = parentReq.targetUnitBankAccountId || parentReq.creditAccountId;
                        }
                    }
                }

                // Priority 2: ExpenseProgram or ExpenseItem
                let resolvedDebitId = reqDebitId || expenseProgram?.debitAccountId || expenseItem?.debitAccountId || expenseItem?.accountId || '';
                let resolvedCreditId = reqCreditId || expenseProgram?.creditAccountId || expenseItem?.creditAccountId || '';

                // Fallback for Credit (Kas/Bank) if still empty:
                if (!resolvedCreditId) {
                    const isBos = updated.source === 'BOS' || (updated.source !== 'YAYASAN' && updated.planId && updated.planId.endsWith('-BOS')) || (!updated.source && !updated.planId && updated.category && updated.category.trim().toUpperCase() === 'BOS');
                    if (isBos) {
                        const bosBank = await tx.account.findFirst({
                            where: {
                                isDeleted: false,
                                isParent: false,
                                OR: [
                                    { code: '1-1112' },
                                    { name: { contains: 'Dana Terikat' } },
                                    { name: { contains: 'BOS' } }
                                ]
                            }
                        });
                        if (bosBank) resolvedCreditId = bosBank.id;
                    } else if (updated.unitId && updated.unitId !== 'FOUNDATION' && updated.unitId !== 'YAYASAN') {
                        const unitKas = await resolveUnitKasAccount(tx, updated.unitId);
                        if (unitKas) resolvedCreditId = unitKas.id;
                    } else {
                        const yayasanBank = await tx.account.findFirst({
                            where: {
                                isDeleted: false,
                                isParent: false,
                                OR: [
                                    { code: '1-1101' },
                                    { code: '1-1111' },
                                    { name: { contains: 'Kas Yayasan' } },
                                    { name: { contains: 'Bank Yayasan' } }
                                ]
                            }
                        });
                        if (yayasanBank) resolvedCreditId = yayasanBank.id;
                    }
                }

                let debitAccount = '';
                let creditAccount = '';
                let debitName = '';
                let creditName = '';

                if (updated.kategoriAset === 'PENGEMBALIAN') {
                    const refundAccounts = await resolveRefundAccounts(tx, updated);
                    const dAcc = refundAccounts.debitAccount;
                    const cAcc = refundAccounts.creditAccount;
                    debitAccount = dAcc?.id || '';
                    creditAccount = cAcc?.id || '';
                    debitName = dAcc ? `${dAcc.code} - ${dAcc.name}` : 'Rekening Bank Yayasan (Debit)';
                    creditName = cAcc ? `${cAcc.code} - ${cAcc.name}` : 'Kas Unit (Kredit)';
                } else {
                    let debitAccObj = null;
                    if (resolvedDebitId) {
                        debitAccObj = await tx.account.findUnique({ where: { id: resolvedDebitId } });
                    }

                    let creditAccObj = null;
                    if (resolvedCreditId) {
                        creditAccObj = await tx.account.findUnique({ where: { id: resolvedCreditId } });
                    }

                    debitAccount = resolvedDebitId || '';
                    debitName = debitAccObj 
                        ? `${debitAccObj.code} - ${debitAccObj.name}` 
                        : (resolvedDebitId ? (expenseProgram?.name || expenseItem?.name || 'Debit') : 'MENUNGGU COA (Debit)');
                    
                    creditAccount = resolvedCreditId || '';
                    creditName = creditAccObj 
                        ? `${creditAccObj.code} - ${creditAccObj.name}` 
                        : (resolvedCreditId ? 'Kas / Bank' : 'MENUNGGU COA (Kredit)');
                }

                const journal = await tx.journal.create({
                    data: {
                        date: updated.date ? new Date(updated.date) : new Date(),
                        name: targetName,
                        description: journalDescription,
                        reference: updated.nomorNota || (updated.planId ? updated.planId : `REPORT-${updated.id.substring(0, 8)}`),
                        proof: updated.buktiTeks || null,
                        programId: resolvedProgramId,
                        entries: [
                            {
                                accountId: debitAccount,
                                accountName: debitName,
                                debit: parseFloat(updated.amount) || 0,
                                credit: 0
                            },
                            {
                                accountId: creditAccount,
                                accountName: creditName,
                                debit: 0,
                                credit: parseFloat(updated.amount) || 0
                            }
                        ]
                    }
                });

                // Update report with journal info and return this final object
                const finalReport = await tx.budgetReport.update({
                    where: { id: updated.id },
                    data: { journalId: journal.id }
                });

                return finalReport;
            }

            // If status is changed away from APPROVED, delete/soft-delete the associated journal and clear journalId
            if (data.status && data.status !== 'APPROVED' && updated.journalId) {
                await tx.journal.delete({ where: { id: updated.journalId } }).catch(async () => {
                    await tx.journal.update({
                        where: { id: updated.journalId },
                        data: { isDeleted: true }
                    }).catch(() => {});
                });
                
                await tx.budgetReport.update({
                    where: { id: updated.id },
                    data: { journalId: null }
                });
                updated.journalId = null;
            } else if (data.status === 'REJECTED' && updated.journalId) {
                await tx.journal.update({
                    where: { id: updated.journalId },
                    data: { isDeleted: true }
                }).catch(() => {});
            } else if (updated.journalId && (data.amount !== undefined || data.date !== undefined || data.nomorNota !== undefined || data.description !== undefined)) {
                // If amount or fields changed on an APPROVED report, automatically keep journal in sync
                const journal = await tx.journal.findUnique({ where: { id: updated.journalId } });
                if (journal && journal.entries) {
                    const entries = typeof journal.entries === 'string' ? JSON.parse(journal.entries) : journal.entries;
                    const newEntries = data.amount !== undefined ? entries.map(entry => ({
                        ...entry,
                        debit: entry.debit > 0 ? parseFloat(data.amount) : 0,
                        credit: entry.credit > 0 ? parseFloat(data.amount) : 0
                    })) : entries;
                    
                    const journalUpdateData = { entries: newEntries };
                    if (data.date) journalUpdateData.date = new Date(data.date);
                    if (data.nomorNota) journalUpdateData.reference = data.nomorNota;
                    if (data.buktiTeks !== undefined) journalUpdateData.proof = data.buktiTeks;
                    if (data.description) journalUpdateData.description = `Realisasi: ${data.description}`;

                    await tx.journal.update({
                        where: { id: journal.id },
                        data: journalUpdateData
                    }).catch(() => {});
                }
            }
            
            return updated;
        });

        const actionType = data.status === 'APPROVED' ? 'APPROVE' : (data.status === 'REJECTED' ? 'REJECT' : 'UPDATE');
        recordAudit(prisma, {
            req,
            action: actionType,
            entity: report.kategoriAset === 'PENGEMBALIAN' ? 'PengembalianKas' : 'NotaBelanja',
            entityId: report.id,
            unitId: report.unitId,
            fieldId: report.fieldId,
            details: {
                nomorNota: report.nomorNota,
                amount: report.amount,
                description: report.description,
                status: report.status,
                message: actionType === 'APPROVE'
                    ? `Menyetujui nota belanja No. ${report.nomorNota || '-'} (${report.description || '-'}) sebesar Rp ${Math.round(report.amount || 0).toLocaleString('id-ID')}`
                    : (actionType === 'REJECT' ? `Menolak nota belanja No. ${report.nomorNota || '-'} (${report.description || '-'})` : `Memperbarui nota belanja No. ${report.nomorNota || '-'} (${report.description || '-'})`)
            }
        }).catch(() => {});

        res.json({ data: report });
    } catch (error) {
        console.error(`[API Error] PUT /budget-reports/${req.params.id}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// --- BULK CANCEL APPROVAL ---
// POST /budget-reports/bulk-cancel-approval
// Body: { ids: string[] }
// Superadmin only. Resets each APPROVED report → PENDING and deletes its journal.
router.post('/budget-reports/bulk-cancel-approval', requireSuperAdmin, async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Harap kirimkan daftar ID laporan yang valid.' });
        }

        const results = { success: [], failed: [] };

        await prisma.$transaction(async (tx) => {
            // Fetch all requested reports at once
            const reports = await tx.budgetReport.findMany({
                where: { id: { in: ids } }
            });

            for (const report of reports) {
                if (report.status !== 'APPROVED') {
                    results.failed.push({ id: report.id, reason: 'Status bukan APPROVED' });
                    continue;
                }

                // Delete or soft-delete the associated journal entry
                if (report.journalId) {
                    try {
                        await tx.journal.delete({ where: { id: report.journalId } });
                    } catch {
                        // If hard delete fails (e.g. FK constraint), soft-delete it
                        await tx.journal.update({
                            where: { id: report.journalId },
                            data: { isDeleted: true }
                        }).catch(() => {});
                    }
                }

                // Reset report status to PENDING and clear journalId
                await tx.budgetReport.update({
                    where: { id: report.id },
                    data: { status: 'PENDING', journalId: null, notified: false }
                });

                results.success.push(report.id);
            }
        });

        if (results.success.length > 0) {
            recordAudit(prisma, {
                req,
                action: 'CANCEL_APPROVE',
                entity: 'NotaBelanja',
                details: {
                    count: results.success.length,
                    ids: results.success,
                    message: `Membatalkan verifikasi/persetujuan untuk ${results.success.length} nota belanja`
                }
            }).catch(() => {});
        }

        console.log(`[API] bulk-cancel-approval: ${results.success.length} berhasil, ${results.failed.length} gagal`);
        res.json({ message: `${results.success.length} laporan berhasil dibatalkan verifikasinya.`, ...results });
    } catch (error) {
        console.error('[API Error] POST /budget-reports/bulk-cancel-approval:', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/budget-reports/:id', requireAuth, async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const reportId = req.params.id;

        // Ambil data laporan realisasi terlebih dahulu
        const report = await prisma.budgetReport.findUnique({
            where: { id: reportId }
        });

        if (!report) {
            return res.status(404).json({ error: 'Laporan realisasi tidak ditemukan.' });
        }

        // Cek wewenang jika bukan superadmin
        if (req.user.role !== 'superadmin') {
            let userUnitId = req.user.unitId;
            let userFieldId = req.user.fieldId;

            // Load fresh unitId/fieldId dari DB untuk keandalan data
            try {
                const dbUser = await prisma.user.findUnique({
                    where: { id: req.user.id }
                });
                if (dbUser) {
                    userUnitId = dbUser.unitId || userUnitId;
                    userFieldId = dbUser.fieldId || userFieldId;
                }
            } catch (dbErr) {
                console.warn('[DELETE /budget-reports] DB user lookup failed, using JWT values:', dbErr.message);
            }

            let reportUnitId = report.unitId;
            let reportFieldId = report.fieldId;

            // Jika fieldId / unitId pada laporan kosong atau tidak sesuai, periksa parent budget request
            if (report.budgetRequestId) {
                try {
                    const breq = await prisma.budgetRequest.findUnique({
                        where: { id: report.budgetRequestId }
                    });
                    if (breq) {
                        reportFieldId = reportFieldId || breq.fieldId;
                        reportUnitId = reportUnitId || breq.unitId;
                    }
                } catch (bErr) {
                    console.warn('[DELETE /budget-reports] DB parent request lookup failed:', bErr.message);
                }
            }

            const isOwner = (userUnitId && (report.unitId === userUnitId || reportUnitId === userUnitId)) ||
                            (userFieldId && (report.fieldId === userFieldId || reportFieldId === userFieldId));

            if (!isOwner) {
                return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki wewenang untuk menghapus laporan ini.' });
            }

            // Hanya laporan berstatus DRAFT atau REJECTED yang boleh dihapus oleh unit/bidang
            if (report.status !== 'DRAFT' && report.status !== 'REJECTED') {
                return res.status(400).json({ error: 'Gagal menghapus: Laporan sudah diajukan atau diproses.' });
            }
        }

        await prisma.$transaction(async (tx) => {
            if (report.journalId) {
                await tx.journal.delete({ where: { id: report.journalId } }).catch(() => {});
            }
            if (req.query.permanent === 'true') {
                await tx.budgetReport.delete({ where: { id: reportId } });
            } else {
                await tx.budgetReport.update({
                    where: { id: reportId },
                    data: { isDeleted: true, status: 'DELETED' }
                });
            }
        });

        recordAudit(prisma, {
            req,
            action: 'DELETE',
            entity: report.kategoriAset === 'PENGEMBALIAN' ? 'PengembalianKas' : 'NotaBelanja',
            entityId: reportId,
            unitId: report.unitId,
            fieldId: report.fieldId,
            details: {
                nomorNota: report.nomorNota,
                amount: report.amount,
                description: report.description,
                buktiTeks: report.buktiTeks,
                isPermanent: req.query.permanent === 'true',
                message: `Menghapus nota belanja No. ${report.nomorNota || '-'} (${report.description || '-'}) sebesar Rp ${Math.round(report.amount || 0).toLocaleString('id-ID')}`
            }
        }).catch(() => {});
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FUND AVAILABILITY ---
router.get('/fund-availability/:unitId', async (req, res) => {
    try {
        const { unitId } = req.params;
        const prisma = getPrisma(req);

        // 1. Get all distribution settings for this unit
        const settings = await prisma.distributionSetting.findMany({
            where: { unitId, isDeleted: false },
            include: { expenseItem: true, incomeItem: true }
        });

        // 2. Get all payments for students in this unit
        const payments = await prisma.studentPayment.findMany({
            where: {
                student: { unitId },
                isDeleted: false
            }
        });

        // 3. Get all approved budget requests for these expense items
        const expenseItemIds = [...new Set(settings.map(s => s.expenseItemId))];
        const approvedRequests = await prisma.budgetRequest.findMany({
            where: {
                expenseItemId: { in: expenseItemIds },
                status: 'APPROVED',
                isDeleted: false
            }
        });

        // 4. Calculate
        const results = expenseItemIds.map(eid => {
            const itemSettings = settings.filter(s => s.expenseItemId === eid);
            const expenseItem = itemSettings[0]?.expenseItem;

            // Total Allocated from Income
            let totalAllocated = 0;
            itemSettings.forEach(s => {
                const itemPayments = payments.filter(p => p.incomeItemId === s.incomeItemId);
                const sumPayments = itemPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                totalAllocated += (sumPayments * parseFloat(s.percentage) / 100);
            });

            // Total Used (Approved Requests)
            const totalUsed = approvedRequests
                .filter(r => r.expenseItemId === eid)
                .reduce((sum, r) => sum + parseFloat(r.amount), 0);

            return {
                expenseItemId: eid,
                expenseItemName: expenseItem?.name,
                totalAllocated,
                totalUsed,
                available: totalAllocated - totalUsed
            };
        });

        res.json({ data: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- MISC MASTER DATA ---
const cleanDataForModel = (modelName, data) => {
    const clean = { ...data };
    if (modelName === 'academicYear') {
        delete clean.startDate;
        delete clean.endDate;
    }
    if (modelName === 'field') {
        delete clean.fieldId;
    }
    if (modelName === 'classGroup') {
        delete clean.unitId;
    }
    if (modelName === 'account') {
        if (clean.initialBalance !== undefined) {
            clean.balance = parseFloat(clean.initialBalance) || 0;
        }
        delete clean.initialBalance;
        delete clean.normalBalance;
    }
    return clean;
};

// Cache for isDeleted column status to prevent redundant DESCRIBE queries
const isDeletedColumnCache = new Set();

// Helper function to create generic CRUD routes
const createGenericRoutes = (entityName, modelName) => {
    // Table mappings for Hot-Fix and Self-Healing
    const tableMappings = {
        'academicYear': 'AcademicYear',
        'classGroup': 'class_groups',
        'position': 'positions',
        'studentStatus': 'StudentStatus',
        'parentStatus': 'ParentStatus',
        'bosStage': 'bos_stages',
        'bosPos': 'bos_pos',
        'field': 'fields',
        'unit': 'units',
        'class': 'Class',
        'student': 'Student'
    };

    // Middleware to ensure isDeleted column exists for this specific generic model
    const ensureIsDeleted = async (req, res, next) => {
        if (isDeletedColumnCache.has(modelName)) return next();
        
        try {
            const prisma = getPrisma(req);
            const possibleTableNames = [
                tableMappings[modelName],
                modelName,
                modelName.charAt(0).toUpperCase() + modelName.slice(1),
                modelName.toLowerCase()
            ].filter(Boolean);

            for (const tableName of possibleTableNames) {
                try {
                    const columns = await prisma.$queryRawUnsafe(`DESCRIBE \`${tableName}\``);
                    const hasIsDeleted = columns.some(c => (c.Field === 'isDeleted' || c.field === 'isDeleted'));

                    if (!hasIsDeleted) {
                        console.log(`[Hot-Fix] Adding isDeleted to ${tableName}...`);
                        await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE`);
                    }
                    
                    isDeletedColumnCache.add(modelName);
                    return next(); 
                } catch (e) {
                    // Try next possible table name
                }
            }
            next(); 
        } catch (error) {
            console.error(`[Hot-Fix Critical Error] ${modelName}:`, error);
            next();
        }
    };

    router.get(`/${entityName}`, ensureIsDeleted, async (req, res) => {
        try {
            const prisma = getPrisma(req);
            const data = await prisma[modelName].findMany({ where: { isDeleted: false } });
            res.json({ data });
        } catch (error) {
            console.error(`[Generic API Error] GET /${entityName}:`, error);
            res.status(500).json({
                error: `Gagal mengambil data ${entityName}`,
                message: error.message,
                code: error.code,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    router.post(`/${entityName}`, ensureIsDeleted, async (req, res) => {
        try {
            const data = cleanDataForModel(modelName, req.body);
            const item = await getPrisma(req)[modelName].create({ data });
            res.json({ data: item });
        } catch (error) {
            if (error.code === 'P2002') return res.status(400).json({ error: `Nama ${entityName} ini sudah digunakan.` });
            res.status(500).json({ error: error.message });
        }
    });

    router.put(`/${entityName}/:id`, ensureIsDeleted, async (req, res) => {
        try {
            const id = req.params.id;
            const data = cleanDataForModel(modelName, { ...req.body, id });

            // Ensure isDeleted is correctly handled
            if (req.body.isDeleted !== undefined) data.isDeleted = req.body.isDeleted;

            const item = await getPrisma(req)[modelName].upsert({
                where: { id: req.params.id },
                update: data,
                create: data
            });
            res.json({ data: item });
        } catch (error) {
            if (error.code === 'P2002') return res.status(400).json({ error: `Nama ${entityName} ini sudah digunakan oleh data lain.` });
            res.status(500).json({ error: error.message });
        }
    });

    router.delete(`/${entityName}/:id`, ensureIsDeleted, async (req, res) => {
        try {
            const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
            if (isPermanent) {
                await getPrisma(req)[modelName].delete({ where: { id: req.params.id } });
            } else {
                await getPrisma(req)[modelName].update({
                    where: { id: req.params.id },
                    data: { isDeleted: true }
                });
            }
            res.json({ message: 'Success' });
        } catch (error) {
            console.error(`[Generic API Error] DELETE /${entityName}/${req.params.id}:`, error);

            if (error.code === 'P2003') {
                return res.status(400).json({
                    error: "Gagal menghapus permanen",
                    message: `Data ${entityName} ini masih digunakan oleh data lain (seperti Siswa, Transaksi, atau Relasi lainnya). Hapus atau pindahkan data terkait terlebih dahulu.`
                });
            }

            if (error.code === 'P2025') {
                return res.status(404).json({
                    error: "Data tidak ditemukan",
                    message: "Data yang ingin dihapus mungkin sudah dihapus sebelumnya."
                });
            }

            res.status(500).json({
                error: `Gagal menghapus ${entityName}`,
                message: error.message,
                code: error.code,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
};

createGenericRoutes('academic-years', 'academicYear');
createGenericRoutes('class-groups', 'classGroup');
createGenericRoutes('positions', 'position');
createGenericRoutes('student-statuses', 'studentStatus');
createGenericRoutes('parent-statuses', 'parentStatus');
// budget-requests and budget-reports have their own custom routes above (with date parsing)
// DO NOT add createGenericRoutes for them here
// --- RAB PLANS (Custom upsert - DO NOT use createGenericRoutes which only uses .create()) ---
router.get('/rab-plans', async (req, res) => {
    try {
        const data = await getPrisma(req).rabPlan.findMany();
        res.json({ data });
    } catch (error) {
        console.error('[RAB Plans GET Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/rab-plans', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const payload = req.body;

        console.log('----------------------------------------------------');
        console.log('[DEBUG] RAB Plan POST Request Received');
        console.log('[DEBUG] ID:', payload.id);
        console.log('[DEBUG] Year:', payload.academicYearId);
        console.log('[DEBUG] Has Income:', !!payload.income, 'Keys:', payload.income ? Object.keys(payload.income).length : 0);
        console.log('[DEBUG] Has Expense:', !!payload.expense, 'Keys:', payload.expense ? Object.keys(payload.expense).length : 0);

        // Detailed check for components in one expense item if exists
        if (payload.expense) {
            const firstKey = Object.keys(payload.expense)[0];
            if (firstKey) {
                const item = payload.expense[firstKey];
                console.log(`[DEBUG] Sample Item (${firstKey}) Components:`, item.components ? item.components.length : 'NONE');
            }
        }

        if (!payload.id) {
            console.warn('[RAB Plan POST] Rejected: Missing ID');
            return res.status(400).json({ error: 'RAB Plan harus memiliki ID.' });
        }

        if (!payload.academicYearId) {
            console.warn('[RAB Plan POST] Rejected: Missing academicYearId');
            return res.status(400).json({ error: 'RAB Plan harus memiliki academicYearId.' });
        }

        // Sanitize - note: updatedAt is omitted here because Prisma handles it via @updatedAt
        const cleanPayload = {
            id: payload.id,
            academicYearId: payload.academicYearId, // required, NOT null
            unitId: payload.unitId || null,
            fieldId: payload.fieldId || null,
            income: typeof payload.income === 'string' ? JSON.parse(payload.income) : (payload.income || {}),
            expense: typeof payload.expense === 'string' ? JSON.parse(payload.expense) : (payload.expense || {}),
            status: payload.status || 'DRAFT',
            rejectionReason: payload.rejectionReason || null,
            notified: payload.notified ?? false,
            updatedBy: payload.updatedBy || null,
        };

        console.log('[RAB Plan POST] Clean payload to upsert:', JSON.stringify({
            id: cleanPayload.id,
            year: cleanPayload.academicYearId,
            unit: cleanPayload.unitId,
            field: cleanPayload.fieldId
        }));

        // Auto-delete if empty draft
        const isEmpty = (obj) => {
            if (!obj) return true;
            if (Object.keys(obj).length === 0) return true;
            return Object.values(obj).every(arr => Array.isArray(arr) && arr.length === 0);
        };

        if (isEmpty(cleanPayload.income) && isEmpty(cleanPayload.expense) && cleanPayload.status === 'DRAFT') {
            await prisma.rabPlan.deleteMany({ where: { id: cleanPayload.id } });
            console.log(`[RAB Plan] Deleted empty draft instead of upsert: ${cleanPayload.id}`);
            return res.json({ data: { id: cleanPayload.id, isDeleted: true } });
        }

        const item = await prisma.rabPlan.upsert({
            where: { id: cleanPayload.id },
            update: { ...cleanPayload, id: undefined },
            create: cleanPayload,
        });

        console.log(`[RAB Plan UPSERT SUCCESS] ID: ${item.id} | Status: ${item.status}`);
        res.json({ data: item });
    } catch (error) {
        console.error('[RAB Plans POST/Upsert Error] FAILED:', error.message, error.code);
        res.status(500).json({ error: error.message, code: error.code });
    }
});

router.put('/rab-plans/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const id = req.params.id;
        const payload = req.body;

        if (!payload.academicYearId) {
            return res.status(400).json({ error: 'RAB Plan harus memiliki academicYearId.' });
        }

        const cleanPayload = {
            id,
            academicYearId: payload.academicYearId,
            unitId: payload.unitId || null,
            fieldId: payload.fieldId || null,
            income: typeof payload.income === 'string' ? JSON.parse(payload.income) : (payload.income || {}),
            expense: typeof payload.expense === 'string' ? JSON.parse(payload.expense) : (payload.expense || {}),
            status: payload.status || 'DRAFT',
            rejectionReason: payload.rejectionReason || null,
            notified: payload.notified ?? false,
            updatedBy: payload.updatedBy || null,
        };

        const item = await prisma.rabPlan.upsert({
            where: { id },
            update: { ...cleanPayload, id: undefined },
            create: cleanPayload,
        });

        console.log(`[RAB Plan PUT SUCCESS] ID: ${item.id}`);
        res.json({ data: item });
    } catch (error) {
        console.error('[RAB Plans PUT Error]', error.message, error.code);
        res.status(500).json({ error: error.message, code: error.code });
    }
});

router.delete('/rab-plans/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const id = req.params.id;
        await prisma.rabPlan.delete({ where: { id } });
        console.log(`[RAB Plan DELETE SUCCESS] ID: ${id}`);
        res.json({ message: 'Success' });
    } catch (error) {
        console.error('[RAB Plans DELETE Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});


// Classes (with Unit include)
router.get('/classes', async (req, res) => {
    try {
        const data = await getPrisma(req).class.findMany({
            where: { isDeleted: false },
            include: { unit: true }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/classes', async (req, res) => {
    try {
        const item = await getPrisma(req).class.create({ data: req.body });
        res.json({ data: item });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: `Nama kelas "${req.body.name}" sudah digunakan di unit ini.` });
        res.status(500).json({ error: error.message });
    }
});
router.put('/classes/:id', async (req, res) => {
    try {
        const data = { ...req.body, id: req.params.id };
        if (req.body.isDeleted !== undefined) data.isDeleted = req.body.isDeleted;

        const item = await getPrisma(req).class.upsert({
            where: { id: req.params.id },
            update: data,
            create: data
        });
        res.json({ data: item });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: `Gagal memperbarui: Nama kelas "${req.body.name}" sudah digunakan di unit ini.` });
        res.status(500).json({ error: error.message });
    }
});
router.delete('/classes/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).class.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).class.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[API Error] DELETE /classes/${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// --- BOS STAGES ---
router.get('/bos-stages', async (req, res) => {
    try {
        const data = await getPrisma(req).bosStage.findMany({
            where: { isDeleted: false }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/bos-stages', async (req, res) => {
    try {
        const item = await getPrisma(req).bosStage.create({ data: req.body });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/bos-stages/:id', async (req, res) => {
    try {
        const data = { ...req.body, id: req.params.id };
        if (req.body.isDeleted !== undefined) data.isDeleted = req.body.isDeleted;

        const item = await getPrisma(req).bosStage.upsert({
            where: { id: req.params.id },
            update: data,
            create: data
        });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/bos-stages/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const id = req.params.id;
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;

        if (isPermanent) {
            await prisma.$transaction(async (tx) => {
                // Delete associated allocations first
                await tx.bosAllocation.deleteMany({ where: { stageId: id } });
                // Delete the stage
                await tx.bosStage.delete({ where: { id } });
            });
        } else {
            await prisma.bosStage.update({
                where: { id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[API Error] DELETE /bos-stages/${req.params.id}:`, error);

        if (error.code === 'P2003') {
            return res.status(400).json({
                error: "Gagal menghapus permanen",
                message: "Tahap BOS ini masih memiliki data anggaran yang terhubung secara aktif. Hapus data anggaran tersebut terlebih dahulu atau kosongkan tempat sampah secara total."
            });
        }

        res.status(500).json({ error: error.message });
    }
});

// --- BOS POS ---
router.get('/bos-pos', async (req, res) => {
    try {
        const data = await getPrisma(req).bosPos.findMany({
            where: { isDeleted: false }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/bos-pos', async (req, res) => {
    try {
        const item = await getPrisma(req).bosPos.create({ data: req.body });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/bos-pos/:id', async (req, res) => {
    try {
        const data = { ...req.body, id: req.params.id };
        if (req.body.isDeleted !== undefined) data.isDeleted = req.body.isDeleted;

        const item = await getPrisma(req).bosPos.upsert({
            where: { id: req.params.id },
            update: data,
            create: data
        });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/bos-pos/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const id = req.params.id;
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;

        if (isPermanent) {
            await prisma.$transaction(async (tx) => {
                // Delete associated allocations first
                await tx.bosAllocation.deleteMany({ where: { posId: id } });
                // Delete the pos
                await tx.bosPos.delete({ where: { id } });
            });
        } else {
            await prisma.bosPos.update({
                where: { id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[API Error] DELETE /bos-pos/${req.params.id}:`, error);

        if (error.code === 'P2003') {
            return res.status(400).json({
                error: "Gagal menghapus permanen",
                message: "Pos BOS ini masih memiliki data anggaran yang terhubung. Hapus data anggaran tersebut terlebih dahulu."
            });
        }

        res.status(500).json({ error: error.message });
    }
});

// --- BOS ALLOCATIONS ---
router.post('/bos-allocations', async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.amount !== undefined) data.amount = parseFloat(data.amount) || 0;
        if (!data.id) data.id = `BALL-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;
        const item = await getPrisma(req).bosAllocation.upsert({
            where: { id: data.id },
            update: { ...data, id: undefined },
            create: data
        });
        res.json({ data: item });
    } catch (error) {
        console.error('[API Error] POST /bos-allocations:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/bos-allocations/:id', async (req, res) => {
    try {
        const data = { ...req.body, id: req.params.id };
        if (data.amount !== undefined) data.amount = parseFloat(data.amount) || 0;
        const item = await getPrisma(req).bosAllocation.upsert({
            where: { id: req.params.id },
            update: { ...data, id: undefined },
            create: data
        });
        res.json({ data: item });
    } catch (error) {
        console.error('[API Error] PUT /bos-allocations:', error);
        res.status(500).json({ error: error.message });
    }
});
router.delete('/bos-allocations/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const id = req.params.id;
        const isPermanent = req.query.permanent === 'true';
        if (isPermanent) {
            await prisma.bosAllocation.delete({ where: { id } });
        } else {
            await prisma.bosAllocation.update({ where: { id }, data: { isDeleted: true } });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[API Error] DELETE /bos-allocations/${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// --- REPAIR & DEDUPLICATION ---
router.post('/repair/deduplicate', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const results = [];

        await prisma.$transaction(async (tx) => {
            // Helper function for simple master model deduplication (merging by Name)
            // Note: Relations must be handled manually due to varying field names
            const dedupeByField = async (modelName, fieldName = 'name', relUpdateTasks = []) => {
                const items = await tx[modelName].findMany();
                const groups = {};
                items.forEach(item => {
                    const key = item[fieldName]?.toString().trim().toLowerCase();
                    if (!key) return;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(item);
                });

                for (const key in groups) {
                    const group = groups[key];
                    if (group.length > 1) {
                        const master = group.find(i => !i.isDeleted) || group[0];
                        const duplicates = group.filter(i => i.id !== master.id);
                        for (const dup of duplicates) {
                            // Run relationship updates
                            for (const task of relUpdateTasks) {
                                await tx[task.model].updateMany({
                                    where: { [task.fk]: dup.id },
                                    data: { [task.fk]: master.id }
                                });
                            }
                            // Delete duplicate
                            await tx[modelName].delete({ where: { id: dup.id } });
                        }
                        results.push(`Merged ${group.length} ${modelName} named "${master[fieldName]}"`);
                    }
                }
            };

            // 1. Deduplicate Fields
            await dedupeByField('field', 'name', [
                { model: 'unit', fk: 'fieldId' },
                { model: 'expenseItem', fk: 'fieldId' },
                { model: 'program', fk: 'fieldId' },
                { model: 'expenseProgram', fk: 'fieldId' }
            ]);

            // 1b. Deduplicate DistributionSettings
            const allDistSettings = await tx.distributionSetting.findMany();
            const distGroups = {};
            let distDupsCount = 0;
            allDistSettings.forEach(s => {
                // Ignore percentage to catch duplicates that were slightly modified
                const key = `${s.unitId}-${s.incomeItemId}-${s.destId}-${s.destType}-${s.expenseItemId}`;
                if (!distGroups[key]) distGroups[key] = [];
                distGroups[key].push(s);
            });
            for (const key in distGroups) {
                const group = distGroups[key];
                if (group.length > 1) {
                    const master = group.find(i => !i.isDeleted) || group[0];
                    const dups = group.filter(i => i.id !== master.id);
                    for (const dup of dups) {
                        await tx.distributionSetting.delete({ where: { id: dup.id } });
                        distDupsCount++;
                    }
                }
            }
            if (distDupsCount > 0) {
                results.push(`Removed ${distDupsCount} duplicate distribution settings`);
            }


            // 2. Deduplicate Units (within each field)
            const allUnits = await tx.unit.findMany(); // Manual due to scope (fieldId)
            const unitGroups = {};
            allUnits.forEach(u => {
                const key = `${u.fieldId}-${u.name.trim().toLowerCase()}`;
                if (!unitGroups[key]) unitGroups[key] = [];
                unitGroups[key].push(u);
            });
            for (const key in unitGroups) {
                const group = unitGroups[key];
                if (group.length > 1) {
                    const master = group.find(i => !i.isDeleted) || group[0];
                    const dups = group.filter(i => i.id !== master.id);
                    for (const dup of dups) {
                        await tx.student.updateMany({ where: { unitId: dup.id }, data: { unitId: master.id } });
                        await tx.class.updateMany({ where: { unitId: dup.id }, data: { unitId: master.id } });
                        await tx.expenseItem.updateMany({ where: { unitId: dup.id }, data: { unitId: master.id } });
                        await tx.unit.delete({ where: { id: dup.id } });
                    }
                    results.push(`Merged ${group.length} units named "${master.name}"`);
                }
            }

            // 3. Deduplicate Classes (within each unit)
            const allClasses = await tx.class.findMany();
            const classGroups = {};
            allClasses.forEach(c => {
                const key = `${c.unitId}-${c.name.trim().toLowerCase()}`;
                if (!classGroups[key]) classGroups[key] = [];
                classGroups[key].push(c);
            });
            for (const key in classGroups) {
                const group = classGroups[key];
                if (group.length > 1) {
                    const master = group.find(i => !i.isDeleted) || group[0];
                    const dups = group.filter(i => i.id !== master.id);
                    for (const dup of dups) {
                        await tx.student.updateMany({ where: { classId: dup.id }, data: { classId: master.id } });
                        await tx.class.delete({ where: { id: dup.id } });
                    }
                    results.push(`Merged ${group.length} classes named "${master.name}"`);
                }
            }

            // 4. Academic Years
            await dedupeByField('academicYear', 'name', [
                { model: 'student', fk: 'academicYearId' },
                { model: 'bosStage', fk: 'academicYearId' }
            ]);

            // 5. Student Statuses
            await dedupeByField('studentStatus', 'name', [
                { model: 'student', fk: 'statusId' }
            ]);

            // 6. Parent Statuses
            await dedupeByField('parentStatus', 'name', [
                { model: 'student', fk: 'parentStatusId' }
            ]);

            // 7. Positions (Jabatan)
            await dedupeByField('position', 'name', []);

            // 8. BOS Pos & Class Groups
            await dedupeByField('bosPos', 'name', []);
            await dedupeByField('classGroup', 'name', []);
        });

        res.json({ message: 'Pembersihan total selesai', details: results });
    } catch (error) {
        console.error('Deduplication error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// --- BUDGET SHIFTS (PERGESERAN ANGGARAN) ---
// ==========================================

// Helper kode referensi pergeseran
const generateShiftCode = async (prisma) => {
    try {
        const count = await prisma.budgetShift.count();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const num = String(count + 1).padStart(3, '0');
        return `PGS-${dateStr}-${num}`;
    } catch (e) {
        return `PGS-${Date.now().toString().slice(-6)}`;
    }
};

// 1. GET: Ambil daftar seluruh pergeseran anggaran
router.get('/budget-shifts', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { academicYearId, unitId, fieldId, status, type } = req.query;

        const where = {
            isDeleted: false,
            ...(academicYearId ? { academicYearId } : {}),
            ...(status ? { status } : {}),
            ...(type ? { type } : {})
        };

        if (unitId) {
            where.OR = [
                { fromUnitId: unitId },
                { toUnitId: unitId }
            ];
        }

        if (fieldId) {
            where.OR = [
                { fromFieldId: fieldId },
                { toFieldId: fieldId }
            ];
        }

        const data = await prisma.budgetShift.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ data });
    } catch (error) {
        console.error('[Budget Shifts GET Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. POST: Pengajuan Permohonan Pergeseran oleh Unit (Bottom-Up)
router.post('/budget-shifts/request', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const p = req.body;

        if (!p.academicYearId) {
            return res.status(400).json({ error: 'Tahun Ajaran wajib dipilih.' });
        }
        if (!p.amount || parseFloat(p.amount) <= 0) {
            return res.status(400).json({ error: 'Nominal pergeseran harus lebih besar dari 0.' });
        }
        if (!p.reason || !p.reason.trim()) {
            return res.status(400).json({ error: 'Alasan / Urgensi pergeseran anggaran wajib diisi.' });
        }

        const code = p.code || await generateShiftCode(prisma);

        const newShift = await prisma.budgetShift.create({
            data: {
                code,
                academicYearId: p.academicYearId,
                type: 'UNIT_REQUEST',
                transferScope: p.transferScope || 'INTERNAL_UNIT',
                fromUnitId: p.fromUnitId || null,
                fromFieldId: p.fromFieldId || null,
                toUnitId: p.toUnitId || null,
                toFieldId: p.toFieldId || null,
                fromExpenseItemId: p.fromExpenseItemId || null,
                toExpenseItemId: p.toExpenseItemId || null,
                amount: parseFloat(p.amount),
                letterNumber: p.letterNumber || null,
                letterDate: p.letterDate ? new Date(p.letterDate) : null,
                fileProof: p.fileProof || null,
                fileName: p.fileName || null,
                fileType: p.fileType || null,
                reason: p.reason.trim(),
                status: 'PENDING',
                requestedBy: p.requestedBy || null,
                requestedByName: p.requestedByName || null,
                isDeleted: false
            }
        });

        // Audit Log
        recordAudit(prisma, {
            req,
            userId: p.requestedBy,
            userName: p.requestedByName,
            action: 'CREATE_REQUEST',
            entity: 'BudgetShift',
            entityId: newShift.id,
            unitId: p.fromUnitId || p.toUnitId,
            details: {
                code,
                amount: p.amount,
                reason: p.reason,
                letterNumber: p.letterNumber,
                type: 'UNIT_REQUEST'
            }
        }).catch(() => {});

        res.json({ success: true, data: newShift });
    } catch (error) {
        console.error('[Budget Shift Request Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. POST: Instruksi Pergeseran oleh Pengurus/Superadmin (Top-Down)
router.post('/budget-shifts/instruction', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const p = req.body;

        if (!p.academicYearId) {
            return res.status(400).json({ error: 'Tahun Ajaran wajib dipilih.' });
        }
        if (!p.amount || parseFloat(p.amount) <= 0) {
            return res.status(400).json({ error: 'Nominal pergeseran harus lebih besar dari 0.' });
        }
        if (!p.reason || !p.reason.trim()) {
            return res.status(400).json({ error: 'Dasar kebijakan / alasan instruksi wajib diisi.' });
        }

        const code = p.code || await generateShiftCode(prisma);

        const newShift = await prisma.budgetShift.create({
            data: {
                code,
                academicYearId: p.academicYearId,
                type: 'MANAGEMENT_ORDER',
                transferScope: p.transferScope || 'INTERNAL_UNIT',
                fromUnitId: p.fromUnitId || null,
                fromFieldId: p.fromFieldId || null,
                toUnitId: p.toUnitId || null,
                toFieldId: p.toFieldId || null,
                fromExpenseItemId: p.fromExpenseItemId || null,
                toExpenseItemId: p.toExpenseItemId || null,
                amount: parseFloat(p.amount),
                letterNumber: p.letterNumber || null,
                letterDate: p.letterDate ? new Date(p.letterDate) : null,
                fileProof: p.fileProof || null,
                fileName: p.fileName || null,
                fileType: p.fileType || null,
                reason: p.reason.trim(),
                status: 'APPLIED',
                requestedBy: p.requestedBy || null,
                requestedByName: p.requestedByName || 'Pengurus/Yayasan',
                approvedBy: p.approvedBy || p.requestedBy || null,
                approvedByName: p.approvedByName || p.requestedByName || 'Pengurus/Yayasan',
                approvedAt: new Date(),
                isDeleted: false
            }
        });

        // Audit Log
        recordAudit(prisma, {
            req,
            userId: p.approvedBy || p.requestedBy,
            userName: p.approvedByName || p.requestedByName,
            action: 'INSTRUCTION_APPLIED',
            entity: 'BudgetShift',
            entityId: newShift.id,
            details: {
                code,
                amount: p.amount,
                reason: p.reason,
                letterNumber: p.letterNumber,
                type: 'MANAGEMENT_ORDER'
            }
        }).catch(() => {});

        res.json({ success: true, data: newShift });
    } catch (error) {
        console.error('[Budget Shift Instruction Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. PUT: Persetujuan (Approve) oleh Pengurus/Superadmin
router.put('/budget-shifts/:id/approve', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { id } = req.params;
        const { approvedBy, approvedByName, notes } = req.body;

        const existing = await prisma.budgetShift.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Data pergeseran anggaran tidak ditemukan.' });
        }

        const updated = await prisma.budgetShift.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approvedBy: approvedBy || null,
                approvedByName: approvedByName || 'Superadmin',
                approvedAt: new Date()
            }
        });

        // Audit Log
        recordAudit(prisma, {
            req,
            userId: approvedBy,
            userName: approvedByName,
            action: 'APPROVE_SHIFT',
            entity: 'BudgetShift',
            entityId: id,
            details: {
                code: updated.code,
                amount: updated.amount,
                notes: notes || 'Permohonan pergeseran anggaran disetujui'
            }
        }).catch(() => {});

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('[Budget Shift Approve Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 5. PUT: Penolakan (Reject) oleh Pengurus/Superadmin
router.put('/budget-shifts/:id/reject', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { id } = req.params;
        const { approvedBy, approvedByName, rejectionReason } = req.body;

        if (!rejectionReason || !rejectionReason.trim()) {
            return res.status(400).json({ error: 'Alasan penolakan permohonan wajib diisi.' });
        }

        const existing = await prisma.budgetShift.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Data pergeseran anggaran tidak ditemukan.' });
        }

        const updated = await prisma.budgetShift.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: rejectionReason.trim(),
                approvedBy: approvedBy || null,
                approvedByName: approvedByName || 'Superadmin',
                approvedAt: new Date()
            }
        });

        // Audit Log
        recordAudit(prisma, {
            req,
            userId: approvedBy,
            userName: approvedByName,
            action: 'REJECT_SHIFT',
            entity: 'BudgetShift',
            entityId: id,
            details: {
                code: updated.code,
                rejectionReason: rejectionReason.trim()
            }
        }).catch(() => {});

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('[Budget Shift Reject Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 6. PUT: Update dokumen/surat susulan (berguna untuk emergency yang suratnya menyusul)
router.put('/budget-shifts/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { id } = req.params;
        const p = req.body;

        const updateData = {};
        if (p.letterNumber !== undefined) updateData.letterNumber = p.letterNumber;
        if (p.letterDate !== undefined) updateData.letterDate = p.letterDate ? new Date(p.letterDate) : null;
        if (p.fileProof !== undefined) updateData.fileProof = p.fileProof;
        if (p.fileName !== undefined) updateData.fileName = p.fileName;
        if (p.fileType !== undefined) updateData.fileType = p.fileType;
        if (p.reason !== undefined) updateData.reason = p.reason;
        if (p.amount !== undefined) updateData.amount = parseFloat(p.amount);

        const updated = await prisma.budgetShift.update({
            where: { id },
            data: updateData
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('[Budget Shift Update Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 7. DELETE: Soft delete
router.delete('/budget-shifts/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { id } = req.params;

        await prisma.budgetShift.update({
            where: { id },
            data: { isDeleted: true }
        });

        recordAudit(prisma, {
            req,
            action: 'DELETE_SHIFT',
            entity: 'BudgetShift',
            entityId: id,
            details: { message: `Pergeseran anggaran ID ${id} dihapus (soft-delete)` }
        }).catch(() => {});

        res.json({ success: true, message: 'Data pergeseran anggaran berhasil dihapus.' });
    } catch (error) {
        console.error('[Budget Shift Delete Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
