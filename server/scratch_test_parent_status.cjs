const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log("--- Testing ParentStatus Operations ---");
    
    // 1. Check if model exists in prisma client
    if (!prisma.parentStatus) {
        console.error("ERROR: prisma.parentStatus is UNDEFINED!");
        return;
    }
    console.log("SUCCESS: prisma.parentStatus is defined.");

    // 2. Try to find a record
    const record = await prisma.parentStatus.findFirst();
    if (!record) {
        console.log("No record found to test delete.");
        return;
    }
    console.log("Found record:", record.name, "with ID:", record.id);

    // 3. Try soft-delete
    console.log("Attempting soft-delete...");
    const updated = await prisma.parentStatus.update({
        where: { id: record.id },
        data: { isDeleted: true }
    });
    console.log("Soft-delete success:", updated.name);

    // 4. Try restore
    console.log("Restoring...");
    await prisma.parentStatus.update({
        where: { id: record.id },
        data: { isDeleted: false }
    });
    console.log("Restore success.");

  } catch (e) {
    console.error("OPERATION FAILED!");
    console.error("Error Code:", e.code);
    console.error("Error Message:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
