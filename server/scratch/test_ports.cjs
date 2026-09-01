const net = require('net');

function checkPort(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => {
            console.log(`Port ${port} on ${host} is OPEN!`);
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            console.log(`Port ${port} on ${host} timed out.`);
            socket.destroy();
            resolve(false);
        });
        socket.on('error', (err) => {
            console.log(`Port ${port} on ${host} closed: ${err.message}`);
            resolve(false);
        });
        socket.connect(port, host);
    });
}

async function main() {
    console.log('Testing open ports on 127.0.0.1...');
    for (let p of [3306, 5000, 3000, 80, 443, 8080, 5432]) {
        await checkPort(p);
    }
}

main();
