import express from 'express';
import bcrypt from 'bcryptjs';
const router = express.Router();

const getPrisma = (req) => req.app.get('prisma');

// --- ACCOUNTS ---
router.get('/accounts', async (req, res) => {
    try {
        const data = await getPrisma(req).account.findMany({
            where: { isDeleted: false },
            orderBy: { code: 'asc' }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/accounts', async (req, res) => {
    try {
        const { id, code, name, category, type, subType, fund, initialBalance } = req.body;
        const data = await getPrisma(req).account.create({
            data: {
                id, code, name, category, type, subType, fund,
                balance: initialBalance || 0
            }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/accounts/:id', async (req, res) => {
    try {
        console.log(`[Account Update] ID: ${req.params.id}`);
        console.log(`[Account Update] Body:`, req.body);

        const { code, name, category, type, subType, fund, initialBalance, isDeleted } = req.body;
        const data = await getPrisma(req).account.update({
            where: { id: req.params.id },
            data: {
                code, name, category, type, subType, fund,
                balance: initialBalance !== undefined ? parseFloat(initialBalance) : undefined,
                isDeleted: isDeleted !== undefined ? isDeleted : undefined
            }
        });
        console.log(`[Account Update] Success: ${data.name}`);
        res.json({ data });
    } catch (error) {
        console.error(`[Account Update Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/accounts/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).account.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).account.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        let msg = error.message;
        if (error.code === 'P2003') msg = "Gagal menghapus: Akun ini masih memiliki transaksi atau data terhubung.";
        res.status(500).json({ error: msg });
    }
});

// --- JOURNALS ---
router.get('/journals', async (req, res) => {
    try {
        const data = await getPrisma(req).journal.findMany({
            where: { isDeleted: false },
            orderBy: { date: 'desc' }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/journals', async (req, res) => {
    try {
        const { id, date, name, description, entries, reference, programId, phoneNumber } = req.body;
        const data = await getPrisma(req).journal.create({
            data: {
                id,
                date: date ? new Date(date) : new Date(),
                name, description,
                entries: typeof entries === 'string' ? JSON.parse(entries) : entries,
                reference, programId, phoneNumber
            }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ASSETS ---
router.get('/assets', async (req, res) => {
    try {
        const data = await getPrisma(req).asset.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/assets', async (req, res) => {
    try {
        const data = await getPrisma(req).asset.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/assets/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).asset.update({
            where: { id: req.params.id },
            data: { ...req.body, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/assets/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).asset.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).asset.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PROGRAMS ---
router.get('/programs', async (req, res) => {
    try {
        const data = await getPrisma(req).program.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/programs', async (req, res) => {
    try {
        const data = await getPrisma(req).program.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/programs/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).program.update({
            where: { id: req.params.id },
            data: { ...req.body, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/programs/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).program.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).program.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- EXPENSE PROGRAMS ---
router.get('/expense-programs', async (req, res) => {
    try {
        const data = await getPrisma(req).expenseProgram.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/expense-programs', async (req, res) => {
    try {
        const data = await getPrisma(req).expenseProgram.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/expense-programs/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).expenseProgram.update({
            where: { id: req.params.id },
            data: { ...req.body, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/expense-programs/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).expenseProgram.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).expenseProgram.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- USERS ---
router.get('/users', async (req, res) => {
    try {
        const data = await getPrisma(req).user.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { username, password, name, role, unitId, fieldId, id } = req.body;
        
        const prisma = getPrisma(req);
        
        // 1. Check if username already exists
        const existing = await prisma.user.findFirst({
            where: { username, isDeleted: false }
        });
        
        if (existing) {
            return res.status(400).json({ 
                error: `Username "${username}" sudah digunakan. Silakan pilih username lain.` 
            });
        }

        // 2. Check if ID already exists (though USR-uuid should be unique)
        const existingId = await prisma.user.findUnique({ where: { id } });
        if (existingId) {
             return res.status(400).json({ error: `INTERNAL ERROR: User ID sudah ada.` });
        }
        
        // 3. Secure Password Hashing
        const hashedPassword = await bcrypt.hash(password || 'sikak123', 10);
        
        const data = await prisma.user.create({ 
            data: { 
                id, 
                username, 
                name, 
                role, 
                unitId: unitId || null, 
                fieldId: fieldId || null,
                password: hashedPassword
            } 
        });
        res.json({ data });
    } catch (error) {
        console.error(`[Add User Error] ${error.message}`);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username ini sudah terdaftar di sistem.' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const prisma = getPrisma(req);
        
        // Extract only the fields that exist in the User Prisma model
        const { username, name, role, unitId, fieldId, isDeleted, password } = req.body;

        console.log(`[Update User] ID: ${id}, Name: ${name}, Role: ${role}`);
        
        // 1. If username is being changed, check for duplicates
        if (username) {
            const existing = await prisma.user.findFirst({
                where: { 
                    username, 
                    isDeleted: false,
                    id: { not: id } // Must not be the same user
                }
            });
            if (existing) {
                return res.status(400).json({ 
                    error: `Gagal memperbarui: Username "${username}" sudah digunakan oleh orang lain.` 
                });
            }
        }

        // 2. Build clean update payload — only schema fields
        const updatePayload = {};
        if (username !== undefined) updatePayload.username = username;
        if (name !== undefined) updatePayload.name = name;
        if (role !== undefined) updatePayload.role = role;
        if (isDeleted !== undefined) updatePayload.isDeleted = isDeleted;
        // unitId and fieldId can be set to null explicitly
        updatePayload.unitId = unitId || null;
        updatePayload.fieldId = fieldId || null;

        // 3. Handle password — hash if provided, skip if empty
        if (password) {
            updatePayload.password = await bcrypt.hash(password, 10);
        }

        console.log(`[Update User] Payload:`, JSON.stringify(updatePayload));

        const data = await prisma.user.update({
            where: { id },
            data: updatePayload
        });

        console.log(`[Update User] Success: ${data.name}`);
        res.json({ data });
    } catch (error) {
        console.error(`[Update User Error] ${error.message}`);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username ini sudah digunakan oleh user lain.' });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `User dengan ID tersebut tidak ditemukan di database.` });
        }
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).user.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).user.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/journals/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).journal.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).journal.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- BUDGETS ---
router.get('/budgets', async (req, res) => {
    try {
        const data = await getPrisma(req).budget.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/budgets', async (req, res) => {
    try {
        const data = await getPrisma(req).budget.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/budgets/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).budget.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ACADEMIC YEARS ---
router.get('/academic-years', async (req, res) => {
    try {
        const data = await getPrisma(req).academicYear.findMany({
            where: { isDeleted: false },
            orderBy: { name: 'desc' }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/academic-years', async (req, res) => {
    try {
        const { id, name, startDate, endDate, isCurrent, isActive } = req.body;
        const data = await getPrisma(req).academicYear.create({
            data: {
                id, name,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                isCurrent: !!isCurrent,
                isActive: isActive !== undefined ? !!isActive : true
            }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/academic-years/:id', async (req, res) => {
    try {
        const { name, startDate, endDate, isCurrent, isActive, isDeleted } = req.body;
        console.log(`[AcademicYear Update] ID: ${req.params.id}, Dates: ${startDate} to ${endDate}`);
        let data;
        
        // Strategy: First try by ID, then try by Name (in case of ID mismatch)
        const client = getPrisma(req);
        let existing = await client.academicYear.findUnique({ where: { id: req.params.id } });
        
        if (!existing) {
            console.log(`[AcademicYear Update] ID ${req.params.id} not found, trying name fallback: ${name}`);
            existing = await client.academicYear.findUnique({ where: { name: name } });
        }

        if (!existing) {
            throw new Error(`Academic Year with ID ${req.params.id} or name ${name} not found`);
        }

        const updateData = {
            name,
            isCurrent: isCurrent !== undefined ? !!isCurrent : undefined,
            isActive: isActive !== undefined ? !!isActive : undefined,
            isDeleted: isDeleted !== undefined ? !!isDeleted : undefined
        };

        // Include dates if they are valid
        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate) updateData.endDate = new Date(endDate);

        data = await client.academicYear.update({
            where: { id: existing.id },
            data: updateData
        });
        console.log(`[AcademicYear Update] Success for ${name}`);
        res.json({ data });
    } catch (error) {
        console.error(`[AcademicYear Update Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/academic-years/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).academicYear.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).academicYear.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

