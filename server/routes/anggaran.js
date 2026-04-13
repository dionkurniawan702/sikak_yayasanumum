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
        const data = { ...req.body };
        delete data.fieldId;
        
        // Check for existing name to provide better error
        const existing = await getPrisma(req).field.findFirst({
            where: { name: data.name, isDeleted: false }
        });
        if (existing) {
            return res.status(400).json({ error: `Bidang dengan nama "${data.name}" sudah ada.` });
        }

        const field = await getPrisma(req).field.create({ data });
        res.json({ data: field });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: `Ops! Bidang dengan nama "${req.body.name}" sudah ada.` });
        res.status(500).json({ error: error.message });
    }
});

router.put('/fields/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = { ...req.body, id };
        delete data.fieldId;
        if (req.body.isDeleted !== undefined) data.isDeleted = req.body.isDeleted;

        const field = await getPrisma(req).field.upsert({
            where: { id },
            update: data,
            create: data
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
        console.log(`[API] Creating new Unit: ${JSON.stringify(req.body)}`);
        const unit = await getPrisma(req).unit.create({ data: req.body });
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
        const data = { ...req.body, id };
        if (req.body.isDeleted !== undefined) data.isDeleted = req.body.isDeleted;

        console.log(`[API] Upserting Unit ${id}: ${JSON.stringify(data)}`);
        const unit = await getPrisma(req).unit.upsert({
            where: { id },
            update: data,
            create: data
        });
        console.log(`[API] Unit upserted successfully: ${unit.id}`);
        res.json({ data: unit });
    } catch (error) {
        console.error(`[API Error] Upsert Unit failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/units/:id', async (req, res) => {
    try {
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true; 
        if (isPermanent) {
            await getPrisma(req).unit.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).unit.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        let msg = error.message;
        if (error.code === 'P2003') msg = "Gagal menghapus: Unit ini masih memiliki data terkait (Siswa, Item Beban, dll).";
        res.status(500).json({ error: msg });
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
            classId, academicYearId, statusId, parentStatusId, 
            incomeDetails 
        } = req.body;
        
        const student = await getPrisma(req).student.create({
            data: {
                id, name, nis, unitId,
                classId: classId || null,
                academicYearId: academicYearId || null,
                statusId: statusId || null,
                parentStatusId: parentStatusId || null,
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
            classId, academicYearId, statusId, parentStatusId, 
            incomeDetails 
        } = req.body;
        
        // Transaction to update student and details
        const student = await getPrisma(req).$transaction(async (tx) => {
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
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true || true;
        if (isPermanent) {
            await getPrisma(req).student.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).student.update({
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

// Helper function to create generic CRUD routes
const createGenericRoutes = (entityName, modelName) => {
    router.get(`/${entityName}`, async (req, res) => {
        try {
            const prisma = getPrisma(req);
            
            // --- AGGRESSIVE HOT-FIX: Ensure isDeleted column exists ---
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
            
            const tableName = tableMappings[modelName] || (modelName.charAt(0).toUpperCase() + modelName.slice(1));
            
            try {
                const columns = await prisma.$queryRawUnsafe(`DESCRIBE \`${tableName}\``);
                const hasIsDeleted = columns.some(c => (c.Field === 'isDeleted' || c.field === 'isDeleted'));
                
                if (!hasIsDeleted) {
                    console.log(`[Hot-Fix] Adding isDeleted to ${tableName}...`);
                    await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE`);
                }
            } catch (se) {
                console.warn(`[Hot-Fix Warn] Schema check failed for ${tableName}: ${se.message}`);
            }
            // --- End Hot-Fix ---

            const data = await prisma[modelName].findMany({ where: { isDeleted: false } });
            res.json({ data });
        } catch (error) {
            console.error(`[Generic API Error] GET /${entityName}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post(`/${entityName}`, async (req, res) => {
        try {
            const data = cleanDataForModel(modelName, req.body);
            const item = await getPrisma(req)[modelName].create({ data });
            res.json({ data: item });
        } catch (error) {
            if (error.code === 'P2002') return res.status(400).json({ error: `Nama ${entityName} ini sudah digunakan.` });
            res.status(500).json({ error: error.message });
        }
    });

    router.put(`/${entityName}/:id`, async (req, res) => {
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

    router.delete(`/${entityName}/:id`, async (req, res) => {
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
            res.status(500).json({ 
                error: `Gagal pada sistem ${entityName}`, 
                message: error.message 
            });
        }
    });
};

createGenericRoutes('academic-years', 'academicYear');
createGenericRoutes('class-groups', 'classGroup');
createGenericRoutes('positions', 'position');
createGenericRoutes('student-statuses', 'studentStatus');
createGenericRoutes('parent-statuses', 'parentStatus');
createGenericRoutes('rab-plans', 'rabPlan');
createGenericRoutes('bos-stages', 'bosStage');
createGenericRoutes('bos-pos', 'bosPos');

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
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).bosStage.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).bosStage.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[API Error] DELETE /bos-stages/${req.params.id}:`, error);
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
        const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
        if (isPermanent) {
            await getPrisma(req).bosPos.delete({ where: { id: req.params.id } });
        } else {
            await getPrisma(req).bosPos.update({
                where: { id: req.params.id },
                data: { isDeleted: true }
            });
        }
        res.json({ message: 'Success' });
    } catch (error) {
        console.error(`[API Error] DELETE /bos-pos/${req.params.id}:`, error);
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

export default router;
