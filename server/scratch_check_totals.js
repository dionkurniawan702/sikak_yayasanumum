import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTotals() {
    console.log('--- Verifikasi Hitungan Dashboard Anggaran (2026-2027) ---');
    
    try {
        const activeYear = await prisma.academicYear.findFirst({
            where: { name: '2026-2027', isDeleted: false }
        });

        if (!activeYear) {
            console.error('Tahun ajaran 2026-2027 tidak ditemukan.');
            return;
        }

        const students = await prisma.student.findMany({
            where: { 
                academicYearId: activeYear.id,
                isDeleted: false,
                status: { name: { notIn: ['Alumni', 'Pindah', 'Dikeluarkan', 'Cuti', 'Non Aktif'] } }
            },
            include: { status: true }
        });

        const distributionSettings = await prisma.distributionSetting.findMany({
            where: { isDeleted: false }
        });

        const expenseItems = await prisma.expenseItem.findMany({
            where: { isDeleted: false }
        });

        const fields = await prisma.field.findMany({
            where: { isDeleted: false }
        });

        const uRAP = {};
        const fRAP = {};

        students.forEach(student => {
            const incomeDetails = student.incomeDetails || [];
            incomeDetails.forEach(detail => {
                const amount = parseFloat(detail.amount) || 0;
                if (amount <= 0) return;

                const rules = distributionSettings.filter(
                    s => s.unitId === student.unitId && s.incomeItemId === detail.incomeItemId
                );

                if (rules.length === 0) {
                    uRAP[student.unitId] = (uRAP[student.unitId] || 0) + amount;
                } else {
                    rules.forEach(rule => {
                        const percent = parseFloat(rule.percentage) || 0;
                        const share = amount * (percent / 100);
                        if (share <= 0) return;

                        const exItem = expenseItems.find(e => e.id === rule.expenseItemId);
                        const itemName = (exItem?.name || '').toLowerCase().trim();
                        
                        const isFieldItem = (exItem && exItem.fieldId && !exItem.unitId) || 
                                           itemName.includes('penggajian') || 
                                           itemName.includes('pengembangan (umum)') ||
                                           itemName.includes('honor') ||
                                           itemName.includes('yayasan');
                                           
                        const effectiveDestType = isFieldItem ? 'field' : rule.destType;
                        const targetFieldId = isFieldItem ? (exItem?.fieldId || (rule.destType === 'field' ? rule.destId : fields[0]?.id)) : rule.destId;

                        if (effectiveDestType === 'unit') {
                            uRAP[student.unitId] = (uRAP[student.unitId] || 0) + share;
                        } else if (effectiveDestType === 'field') {
                            if (targetFieldId) {
                                fRAP[targetFieldId] = (fRAP[targetFieldId] || 0) + share;
                            }
                        }
                    });
                }
            });
        });

        let totalUnit = 0;
        console.log('\n[RINGKASAN PER UNIT]');
        for (const id in uRAP) {
            totalUnit += uRAP[id];
            console.log(`Unit ${id}: Rp ${uRAP[id].toLocaleString('id-ID')}`);
        }
        console.log(`TOTAL KONSOLIDASI UNIT: Rp ${totalUnit.toLocaleString('id-ID')}`);

        let totalField = 0;
        console.log('\n[RINGKASAN PER BIDANG]');
        for (const id in fRAP) {
            const field = fields.find(f => f.id === id);
            totalField += fRAP[id];
            console.log(`${field?.name || id}: Rp ${fRAP[id].toLocaleString('id-ID')}`);
        }
        
        // Special case for "Bidang Pendidikan" which in UI consolidates all Units
        const sdmField = fields.find(f => f.name === 'Bidang SDM');
        const sdmTotal = fRAP[sdmField?.id] || 0;
        
        console.log(`\nTOTAL KONSOLIDASI BIDANG (MURNI FIELD): Rp ${totalField.toLocaleString('id-ID')}`);
        console.log(`TOTAL KONSOLIDASI DASHBOARD (FIELD + UNIT): Rp ${(totalField + totalUnit).toLocaleString('id-ID')}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTotals();
