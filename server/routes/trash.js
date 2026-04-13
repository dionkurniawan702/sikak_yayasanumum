import express from 'express';
const router = express.Router();

const getPrisma = (req) => req.app.get('prisma');

// DELETE /api/trash/empty
router.delete('/empty', async (req, res) => {
    try {
        const prisma = getPrisma(req);
        
        await prisma.$transaction(async (tx) => {
            // Disable foreign key checks for mass deletion
            await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
            
            const models = [
                'journal', 'account', 'asset', 'program', 'expenseProgram', 
                'user', 'unit', 'field', 'student', 'class', 
                'incomeItem', 'expenseItem', 'distributionSetting',
                'academicYear', 'classGroup', 'position', 'studentStatus', 
                'parentStatus', 'budgetRequest', 'budgetReport', 'rabPlan'
            ];
            
            for (const model of models) {
                try {
                    // Not every model has isDeleted, but we only delete those that do
                    await tx[model].deleteMany({
                        where: { isDeleted: true }
                    });
                } catch (e) {
                    // Skip if model doesn't have isDeleted or doesn't exist
                    console.log(`[Trash] Skipping empty for ${model}: ${e.message}`);
                }
            }
            
            await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
        });
        
        res.json({ success: true, message: 'Trash emptied successfully' });
    } catch (error) {
        console.error(`[Trash Error] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

export default router;
