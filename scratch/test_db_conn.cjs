const net = require('net');

function checkPort(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => {
            socket.destroy();
            resolve({ host, port, status: 'OPEN' });
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve({ host, port, status: 'TIMEOUT' });
        });
        socket.on('error', (err) => {
            socket.destroy();
            resolve({ host, port, status: 'ERROR', error: err.message });
        });
        socket.connect(port, host);
    });
}

async function test() {
    console.log('Testing DB connections:');
    console.log(await checkPort('localhost', 3306));
    console.log(await checkPort('127.0.0.1', 3306));
}

test();
