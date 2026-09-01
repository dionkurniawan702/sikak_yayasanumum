async function testPort(port) {
    try {
        const res = await fetch(`http://localhost:${port}/api/health`);
        const text = await res.text();
        console.log(`Port ${port}: status=${res.status}, response=${text}`);
    } catch (e) {
        console.log(`Port ${port}: ${e.message}`);
    }
}

async function main() {
    await testPort(5000);
    await testPort(3000);
    await testPort(8080);
}

main();
