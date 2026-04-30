const fs = require('fs');
const path = 'd:\\SIKAK YAYASAN UMUM\\src\\pages\\anggaran\\RAB.jsx';
let content = fs.readFileSync(path, 'utf8');

// The mangled section looks something like this:
// ... setCurrentPlan(nextPlan);
// ... const basePlanId = `${selectedYearId}-${selectedUnitId}`;
// (MISSING CODE)
// ... return (
// ... <tr key={`TEMP-${itemMaster.id}`} ...

const targetMarker = 'const basePlanId = `${selectedYearId}-${selectedUnitId}`;';
const returnMarker = 'return (';

const parts = content.split(targetMarker);
if (parts.length < 2) {
    console.error('Target marker not found!');
    process.exit(1);
}

// We want to replace everything from targetMarker to the first "return (" after it.
const afterTarget = parts[1];
const returnIdx = afterTarget.indexOf(returnMarker);

if (returnIdx === -1) {
    console.error('Return marker not found after target!');
    process.exit(1);
}

const correctCode = `const basePlanId = \`\${selectedYearId}-\${selectedUnitId}\`;
                                                                         const planId = \`\${basePlanId}-\${fundSourceFilter === 'BOS' ? 'BOS' : 'YAYASAN'}\`;
                                                                         const dbPlan = {
                                                                             id: planId,
                                                                             academicYearId: selectedYearId,
                                                                             unitId: selectedUnitId.startsWith('FIELD-') ? null : (selectedUnitId === 'FOUNDATION' ? 'FOUNDATION' : selectedUnitId),
                                                                             fieldId: selectedUnitId.startsWith('FIELD-') ? selectedUnitId.replace('FIELD-', '') : null,
                                                                             income: nextPlan.income,
                                                                             expense: nextPlan.expense,
                                                                             status: nextPlan.status,
                                                                             rejectionReason: nextPlan.rejectionReason,
                                                                             updatedAt: new Date().toISOString(),
                                                                             updatedBy: currentUser?.username
                                                                         };
                                                                         await persistPlanToServer(dbPlan); 
                                                                         setMessage({ type: 'success', text: 'Item rincian berhasil dihapus secara permanen.' });
                                                                     }
                                                                 }}
                                                                 className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                                 title="HAPUS RENCANA"
                                                             >
                                                                 <Trash2 size={18} />
                                                             </button>
                                                         )}
                                                     </div>
                                                 }
                                             />
                                         );
                                     });
                                 }
                                 if (filterMonth || filterProgram) return [];
                                 
`;

const newContent = parts[0] + correctCode + afterTarget.substring(returnIdx);

fs.writeFileSync(path, newContent);
console.log('File fixed successfully!');
