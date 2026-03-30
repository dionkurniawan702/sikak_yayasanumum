import express from 'express';
const router = express.Router();

// Helper to get Prisma Client from the request (attached in index.js)
const getPrisma = (req) => req.app.get('prisma');

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
        const field = await getPrisma(req).field.create({ data: req.body });
        res.json({ data: field });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/fields/:id', async (req, res) => {
    try {
        const field = await getPrisma(req).field.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data: field });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/fields/:id', async (req, res) => {
    try {
        await getPrisma(req).field.update({
            where: { id: req.params.id },
            data: { isDeleted: true }
        });
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        const unit = await getPrisma(req).unit.create({ data: req.body });
        res.json({ data: unit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/units/:id', async (req, res) => {
    try {
        const unit = await getPrisma(req).unit.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data: unit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/units/:id', async (req, res) => {
    try {
        await getPrisma(req).unit.update({
            where: { id: req.params.id },
            data: { isDeleted: true }
        });
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- STUDENT & INCOME ---
router.get('/students', async (req, res) => {
    try {
        const students = await getPrisma(req).student.findMany({ 
            where: { isDeleted: false },
            include: { unit: true, incomeDetails: true }
        });
        res.json({ data: students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/students', async (req, res) => {
    try {
        const { id, name, nis, unitId, incomeDetails } = req.body;
        const student = await getPrisma(req).student.create({
            data: {
                id, name, nis, unitId,
                incomeDetails: {
                    create: incomeDetails.map(d => ({
                        incomeItemId: d.incomeItemId,
                        amount: d.amount
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
        const { name, nis, unitId, incomeDetails } = req.body;
        
        // Transaction to update student and details
        const student = await getPrisma(req).$transaction(async (tx) => {
            await tx.studentIncomeDetail.deleteMany({ where: { studentId: req.params.id } });
            return tx.student.update({
                where: { id: req.params.id },
                data: {
                    name, nis, unitId,
                    incomeDetails: {
                        create: (incomeDetails || []).map(d => ({
                            incomeItemId: d.incomeItemId,
                            amount: d.amount
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
        await getPrisma(req).student.update({
            where: { id: req.params.id },
            data: { isDeleted: true }
        });
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
            data: req.body
        });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/income-items/:id', async (req, res) => {
    try {
        await getPrisma(req).incomeItem.update({
            where: { id: req.params.id },
            data: { isDeleted: true }
        });
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
            data: req.body
        });
        res.json({ data: item });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/expense-items/:id', async (req, res) => {
    try {
        await getPrisma(req).expenseItem.update({
            where: { id: req.params.id },
            data: { isDeleted: true }
        });
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

router.post('/distribution-settings', async (req, res) => {
    try {
        const { unitId, incomeItemId, settings } = req.body;
        
        await getPrisma(req).$transaction([
            getPrisma(req).distributionSetting.deleteMany({
                where: { unitId, incomeItemId }
            }),
            getPrisma(req).distributionSetting.createMany({
                data: settings.map(s => ({
                    unitId: s.unitId,
                    incomeItemId: s.incomeItemId,
                    expenseItemId: s.expenseItemId,
                    percentage: s.percentage
                }))
            })
        ]);
        
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- BUDGET REQUESTS & REPORTS ---
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

router.post('/budget-requests', async (req, res) => {
    try {
        const request = await getPrisma(req).budgetRequest.create({ data: req.body });
        res.json({ data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/budget-requests/:id', async (req, res) => {
    try {
        const request = await getPrisma(req).budgetRequest.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ data: request });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/budget-reports', async (req, res) => {
    try {
        const { budgetRequestId, amount, description, date, expenseItemId } = req.body;
        const prisma = getPrisma(req);
        
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Report
            const report = await tx.budgetReport.create({
                data: { budgetRequestId, amount, description, date, expenseItemId }
            });
            
            // 2. Fetch Expense Item to get Account Mapping
            const expenseItem = await tx.expenseItem.findUnique({
                where: { id: expenseItemId },
                include: { unit: true }
            });
            
            // 3. Create Journal Entry
            if (expenseItem && expenseItem.accountId) {
                const journal = await tx.journal.create({
                    data: {
                        date: new Date(date),
                        name: `Laporan Anggaran: ${expenseItem.name}`,
                        description: `Pelaporan anggaran untuk unit ${expenseItem.unit?.name || ''}. ${description || ''}`,
                        entries: JSON.stringify([
                            {
                                accountId: expenseItem.accountId,
                                accountName: expenseItem.name,
                                debit: parseFloat(amount),
                                credit: 0
                            },
                            {
                                accountId: '11101', // Default Kas/Bank (Should be dynamic ideally)
                                accountName: 'Kas Besar',
                                debit: 0,
                                credit: parseFloat(amount)
                            }
                        ]),
                        reference: `REPORT-${report.id.substring(0,8)}`
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
        
        res.json({ data: result });
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

// Helper function to create generic CRUD routes
const createGenericRoutes = (entityName, modelName) => {
    router.get(`/${entityName}`, async (req, res) => {
        try {
            const data = await getPrisma(req)[modelName].findMany({ where: { isDeleted: false } });
            res.json({ data });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post(`/${entityName}`, async (req, res) => {
        try {
            const item = await getPrisma(req)[modelName].create({ data: req.body });
            res.json({ data: item });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put(`/${entityName}/:id`, async (req, res) => {
        try {
            const item = await getPrisma(req)[modelName].update({
                where: { id: req.params.id },
                data: req.body
            });
            res.json({ data: item });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete(`/${entityName}/:id`, async (req, res) => {
        try {
            await getPrisma(req)[modelName].update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
            res.json({ message: 'Success' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};

createGenericRoutes('academic-years', 'academicYear');
createGenericRoutes('class-groups', 'classGroup');
createGenericRoutes('positions', 'position');
createGenericRoutes('student-statuses', 'studentStatus');
createGenericRoutes('parent-statuses', 'parentStatus');

export default router;
