import express from 'express';
import bcrypt from 'bcryptjs';
import { recordAudit } from './audit.js';
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
        const { id, code, name, category, type, subType, fund, initialBalance, balance, isParent } = req.body;
        const prisma = getPrisma(req);

        // Check if account with same ID or code already exists
        const existing = await prisma.account.findFirst({
            where: {
                OR: [
                    ...(id ? [{ id }] : []),
                    ...(code ? [{ code }] : [])
                ]
            }
        });

        const accountData = {
            code,
            name,
            category: category || (isParent ? 'header' : 'detail'),
            type,
            subType,
            fund,
            balance: initialBalance !== undefined ? parseFloat(initialBalance) : (balance !== undefined ? parseFloat(balance) : 0),
            isParent: isParent !== undefined ? Boolean(isParent) : (category === 'header'),
            isDeleted: false
        };

        if (existing) {
            const data = await prisma.account.update({
                where: { id: existing.id },
                data: accountData
            });
            console.log(`[Account Create/Reactivate] Success: ${data.code} - ${data.name}`);
            return res.json({ data });
        }

        const data = await prisma.account.create({
            data: {
                id: id || undefined,
                ...accountData
            }
        });
        console.log(`[Account Create] Success: ${data.code} - ${data.name}`);
        res.json({ data });
    } catch (error) {
        console.error(`[Account Create Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.put('/accounts/:id', async (req, res) => {
    try {
        console.log(`[Account Update] ID: ${req.params.id}, Body:`, req.body);
        const { code, name, category, type, subType, fund, initialBalance, balance, isDeleted, isParent } = req.body;
        const prisma = getPrisma(req);

        let target = await prisma.account.findUnique({ where: { id: req.params.id } });
        if (!target && code) {
            target = await prisma.account.findFirst({ where: { code } });
        }
        if (!target) {
            target = await prisma.account.findFirst({ where: { code: req.params.id } });
        }

        if (!target) {
            return res.status(404).json({ error: 'Akun tidak ditemukan' });
        }

        const data = await prisma.account.update({
            where: { id: target.id },
            data: {
                code: code !== undefined ? code : target.code,
                name: name !== undefined ? name : target.name,
                category: category !== undefined ? category : target.category,
                type: type !== undefined ? type : target.type,
                subType: subType !== undefined ? subType : target.subType,
                fund: fund !== undefined ? fund : target.fund,
                balance: initialBalance !== undefined ? parseFloat(initialBalance) : (balance !== undefined ? parseFloat(balance) : target.balance),
                isParent: isParent !== undefined ? Boolean(isParent) : (category === 'header' ? true : target.isParent),
                isDeleted: isDeleted !== undefined ? isDeleted : target.isDeleted
            }
        });
        console.log(`[Account Update] Success: ${data.code} - ${data.name}`);
        res.json({ data });
    } catch (error) {
        console.error(`[Account Update Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/accounts/:id', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        let target = await prisma.account.findUnique({ where: { id: req.params.id } });
        if (!target) {
            target = await prisma.account.findFirst({ where: { code: req.params.id } });
        }
        if (!target) {
            return res.status(404).json({ error: 'Akun tidak ditemukan' });
        }

        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await prisma.account.delete({ where: { id: target.id } });
        } else {
            await prisma.account.update({
                where: { id: target.id },
                data: { isDeleted: true }
            });
        }
        console.log(`[Account Delete] Success: ${target.code} (permanent=${isPermanent})`);
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
        const prisma = getPrisma(req);
        const { month, startDate, endDate, limit, page } = req.query;

        let where = { isDeleted: false };

        if (month && month !== 'ALL') {
            const [y, m] = month.split('-').map(Number);
            const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
            const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            where.date = { gte: start, lte: end };
        } else if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const totalCount = await prisma.journal.count({ where });

        let queryOptions = {
            where,
            orderBy: { date: 'desc' }
        };

        if (limit) {
            const take = parseInt(limit, 10);
            queryOptions.take = take;
            if (page) {
                const skip = (parseInt(page, 10) - 1) * take;
                queryOptions.skip = Math.max(0, skip);
            }
        }

        const data = await prisma.journal.findMany(queryOptions);
        res.json({ data, totalCount });
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
        recordAudit(getPrisma(req), {
            req,
            action: 'CREATE',
            entity: 'Jurnal',
            entityId: data.id,
            details: {
                reference: data.reference,
                name: data.name,
                description: data.description,
                message: `Mencatat entri Jurnal Umum: ${data.name || ''} - ${data.description || ''} (Ref: ${data.reference || '-'})`
            }
        }).catch(() => {});
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/journals/:id', async (req, res) => {
    try {
        const { date, name, description, entries, reference, proof, programId, phoneNumber } = req.body;
        const prisma = getPrisma(req);

        const updateData = {};
        if (date !== undefined) updateData.date = date ? new Date(date) : null;
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (entries !== undefined) updateData.entries = typeof entries === 'string' ? JSON.parse(entries) : entries;
        if (reference !== undefined) updateData.reference = reference;
        if (proof !== undefined) updateData.proof = proof;
        if (programId !== undefined) updateData.programId = programId;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

        const data = await prisma.journal.update({
            where: { id: req.params.id },
            data: updateData
        });

        recordAudit(prisma, {
            req,
            action: 'UPDATE',
            entity: 'Jurnal',
            entityId: data.id,
            details: {
                reference: data.reference,
                name: data.name,
                description: data.description,
                message: `Memperbarui entri Jurnal Umum: ${data.name || ''} - ${data.description || ''} (Ref: ${data.reference || '-'})`
            }
        }).catch(() => {});

        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ASSETS ---
const cleanAssetData = (body) => {
    const data = { ...body };
    if (data.cost !== undefined) data.cost = parseFloat(data.cost) || 0;
    if (data.residualValue !== undefined) data.residualValue = parseFloat(data.residualValue) || 0;
    if (data.usefulLifeMonths !== undefined) {
        data.usefulLifeMonths = parseInt(data.usefulLifeMonths, 10) || 0;
    } else if (data.economicLife !== undefined) {
        data.usefulLifeMonths = (parseInt(data.economicLife, 10) || 4) * 12;
    }
    if (data.acquisitionDate) {
        try {
            const d = new Date(data.acquisitionDate);
            data.acquisitionDate = isNaN(d.getTime()) ? new Date() : d;
        } catch (e) {
            data.acquisitionDate = new Date();
        }
    }
    delete data.economicLife;
    return data;
};

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
        const payload = cleanAssetData(req.body);
        const data = await getPrisma(req).asset.create({ data: payload });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/assets/:id', async (req, res) => {
    try {
        const payload = cleanAssetData(req.body);
        const data = await getPrisma(req).asset.update({
            where: { id: req.params.id },
            data: { ...payload, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
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

// --- ASSET MASTER: CATEGORIES ---
router.get('/asset-categories', async (req, res) => {
    try {
        const data = await getPrisma(req).assetCategory.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/asset-categories', async (req, res) => {
    try {
        const clean = { ...req.body };
        if (clean.economicLife !== undefined) clean.economicLife = parseInt(clean.economicLife, 10) || 4;
        const data = await getPrisma(req).assetCategory.create({ data: clean });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/asset-categories/:id', async (req, res) => {
    try {
        const clean = { ...req.body };
        if (clean.economicLife !== undefined) clean.economicLife = parseInt(clean.economicLife, 10) || 4;
        const data = await getPrisma(req).assetCategory.update({
            where: { id: req.params.id },
            data: clean
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/asset-categories/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).assetCategory.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).assetCategory.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ASSET MASTER: VENDORS ---
router.get('/asset-vendors', async (req, res) => {
    try {
        const data = await getPrisma(req).assetVendor.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/asset-vendors', async (req, res) => {
    try {
        const data = await getPrisma(req).assetVendor.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/asset-vendors/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).assetVendor.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/asset-vendors/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).assetVendor.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).assetVendor.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ASSET MASTER: ROOMS ---
router.get('/asset-rooms', async (req, res) => {
    try {
        const data = await getPrisma(req).assetRoom.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/asset-rooms', async (req, res) => {
    try {
        const data = await getPrisma(req).assetRoom.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/asset-rooms/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).assetRoom.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/asset-rooms/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).assetRoom.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).assetRoom.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ASSET MASTER: PICS ---
router.get('/asset-pics', async (req, res) => {
    try {
        const data = await getPrisma(req).assetPic.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/asset-pics', async (req, res) => {
    try {
        const data = await getPrisma(req).assetPic.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/asset-pics/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).assetPic.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/asset-pics/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).assetPic.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).assetPic.update({
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
        const rawPassword = password || 'sikak123';
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        
        const data = await prisma.user.create({ 
            data: { 
                id, 
                username, 
                name, 
                role, 
                unitId: unitId || null, 
                fieldId: fieldId || null,
                password: hashedPassword,
                plainPassword: rawPassword
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
            const currentUser = await prisma.user.findUnique({ where: { id } });
            
            if (currentUser && currentUser.username !== username) {
                const existing = await prisma.user.findFirst({
                    where: { 
                        username, 
                        isDeleted: false
                    }
                });
                if (existing) {
                    return res.status(400).json({ 
                        error: `Gagal memperbarui: Username "${username}" sudah digunakan oleh orang lain.` 
                    });
                }
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
            updatePayload.plainPassword = password; // Store plaintext for superadmin visibility
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
        recordAudit(getPrisma(req), {
            req,
            action: 'DELETE',
            entity: 'Jurnal',
            entityId: req.params.id,
            details: {
                isPermanent,
                message: `Menghapus entri Jurnal Umum ID: ${req.params.id}`
            }
        }).catch(() => {});
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

