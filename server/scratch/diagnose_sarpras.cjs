/**
 * SCRIPT DIAGNOSTIK: Mencari asal item Penggajian & Pengembangan dan Pelatihan di Bidang Sarana Prasarana
 * Jalankan: node server/scratch/diagnose_sarpras.cjs
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== DIAGNOSA BIDANG SARANA PRASARANA ===\n');

    // 1. Cari bidang Sarana Prasarana
    const fields = await prisma.field.findMany({ where: { isDeleted: false } });
    const sarpras = fields.find(f => f.name.toLowerCase().includes('sarana'));
    if (!sarpras) {
        console.log('❌ Bidang Sarana Prasarana tidak ditemukan!');
        return;
    }
    console.log(`✅ Bidang ditemukan: "${sarpras.name}" (id: ${sarpras.id})\n`);

    // 2. Cari semua expense items milik Bidang Sarana Prasarana
    const expenseItems = await prisma.expenseItem.findMany({ where: { isDeleted: false } });
    const sarprasItems = expenseItems.filter(e => e.fieldId === sarpras.id);
    
    console.log(`📦 Item Pengeluaran yang terdaftar di Bidang Sarana Prasarana:`);
    sarprasItems.forEach(item => {
        console.log(`   - [${item.id}] "${item.name}" | unitId: ${item.unitId || 'null'} | fieldId: ${item.fieldId}`);
    });

    // 3. Cari item Penggajian dan Pengembangan secara nama
    const targetKeywords = ['penggajian', 'pengembangan', 'pelatihan'];
    const matchedItems = expenseItems.filter(e => 
        targetKeywords.some(kw => e.name.toLowerCase().includes(kw))
    );

    console.log(`\n🔍 Semua item dengan kata kunci "penggajian/pengembangan/pelatihan":`);
    matchedItems.forEach(item => {
        const isSarpras = item.fieldId === sarpras.id;
        console.log(`   ${isSarpras ? '⚠️' : '  '} [${item.id}] "${item.name}" | unitId: ${item.unitId || 'null'} | fieldId: ${item.fieldId || 'null'}`);
    });

    // 4. Cari distributionSettings yang mengarah ke item-item tersebut
    const distributions = await prisma.distributionSetting.findMany({ where: { isDeleted: false } });
    const units = await prisma.unit.findMany({ where: { isDeleted: false } });

    const sarprasItemIds = new Set(sarprasItems.map(e => e.id));
    const matchedItemIds = new Set(matchedItems.map(e => e.id));

    console.log(`\n🔗 Aturan Distribusi yang mengarah ke item Sarpras/Penggajian/Pengembangan:`);
    let found = false;
    distributions.forEach(dist => {
        const isTargetItem = sarprasItemIds.has(dist.expenseItemId) || matchedItemIds.has(dist.expenseItemId);
        if (isTargetItem) {
            const unit = units.find(u => u.id === dist.unitId);
            const expItem = expenseItems.find(e => e.id === dist.expenseItemId);
            console.log(`   📌 Unit: "${unit?.name || dist.unitId}" → Item: "${expItem?.name || dist.expenseItemId}" | ${dist.percentage}% | destType: ${dist.destType} | destId: ${dist.destId}`);
            found = true;
        }
    });
    if (!found) {
        console.log('   (Tidak ada aturan distribusi yang cocok)');
    }

    // 5. Cari unit dengan incomeItems yang menghasilkan distribusi ke Sarpras
    console.log(`\n🏫 RINGKASAN - Unit yang berkontribusi ke Bidang Sarana Prasarana:`);
    const unitContributors = {};
    distributions.forEach(dist => {
        const isTargetItem = sarprasItemIds.has(dist.expenseItemId) || matchedItemIds.has(dist.expenseItemId);
        if (isTargetItem) {
            const unit = units.find(u => u.id === dist.unitId);
            const expItem = expenseItems.find(e => e.id === dist.expenseItemId);
            const key = dist.unitId;
            if (!unitContributors[key]) {
                unitContributors[key] = { unitName: unit?.name || dist.unitId, items: [] };
            }
            unitContributors[key].items.push(`${expItem?.name || dist.expenseItemId} (${dist.percentage}%)`);
        }
    });

    Object.values(unitContributors).forEach(u => {
        console.log(`\n   ▸ ${u.unitName}:`);
        u.items.forEach(item => console.log(`       → ${item}`));
    });

    if (Object.keys(unitContributors).length === 0) {
        console.log('   (Tidak ada unit yang teridentifikasi)');
        console.log('\n   ℹ️  Kemungkinan nilai RAP dari Bidang Sarpras berasal dari data RAB (expenseItems.fieldId),');
        console.log('   bukan dari distribusi siswa. Cek RAB plan yang filed ke Sarpras langsung.');
    }

    console.log('\n=== SELESAI ===');
}

main()
    .catch(e => { console.error('Error:', e.message); })
    .finally(() => prisma.$disconnect());
