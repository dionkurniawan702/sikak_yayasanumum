import express from 'express';
const router = express.Router();

const getPrisma = (req) => req.app.get('prisma');

router.get('/accounts', async (req, res) => {
    try {
        const data = await getPrisma(req).account.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/journals', async (req, res) => {
    try {
        const data = await getPrisma(req).journal.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/assets', async (req, res) => {
    try {
        const data = await getPrisma(req).asset.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/programs', async (req, res) => {
    try {
        const data = await getPrisma(req).program.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users', async (req, res) => {
    try {
        const data = await getPrisma(req).user.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/budgets', async (req, res) => {
    try {
        const data = await getPrisma(req).budget.findMany({ where: { isDeleted: false } });
        res.json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
