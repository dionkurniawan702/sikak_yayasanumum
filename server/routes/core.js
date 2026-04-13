import express from 'express';
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
        if (req.query.permanent === 'true') {
            try {
                await getPrisma(req).account.delete({ where: { id: req.params.id } });
            } catch (e) {
                if (e.code !== 'P2025' && e.code !== 'P2016') throw e;
            }
        } else {
            try {
                await getPrisma(req).account.update({
                    where: { id: req.params.id },
                    data: { isDeleted: true }
                });
            } catch (e) {
                if (e.code !== 'P2025' && e.code !== 'P2016') throw e;
            }
        }
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        if (req.query.permanent === 'true') {
            try {
                await getPrisma(req).asset.delete({ where: { id: req.params.id } });
            } catch (e) {
                if (e.code !== 'P2025' && e.code !== 'P2016') throw e;
            }
        } else {
            try {
                await getPrisma(req).asset.update({
                    where: { id: req.params.id },
                    data: { isDeleted: true }
                });
            } catch (e) {
                if (e.code !== 'P2025' && e.code !== 'P2016') throw e;
            }
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
        if (req.query.permanent === 'true') {
            try {
                await getPrisma(req).program.delete({ where: { id: req.params.id } });
            } catch (e) {
                if (e.code !== 'P2025' && e.code !== 'P2016') throw e;
            }
        } else {
            try {
                await getPrisma(req).program.update({
                    where: { id: req.params.id },
                    data: { isDeleted: true }
                });
            } catch (e) {
                if (e.code !== 'P2025' && e.code !== 'P2016') throw e;
            }
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
        if (req.query.permanent === 'true') {
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
        const data = await getPrisma(req).user.create({ data: req.body });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const data = await getPrisma(req).user.update({
            where: { id: req.params.id },
            data: { ...req.body, isDeleted: req.body.isDeleted !== undefined ? req.body.isDeleted : undefined }
        });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        if (req.query.permanent === 'true') {
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
        if (req.query.permanent === 'true') {
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

export default router;

