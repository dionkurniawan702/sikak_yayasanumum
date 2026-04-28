import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function repair() {
    console.log('--- MANUAL DATABASE REPAIR ---');
    
    // Try to connect via localhost/127.0.0.1 (assuming Docker port 3306 is forwarded)
    const config = {
        host: '127.0.0.1',
        user: 'mysql',
        password: '7dff32cee8db81c86c80',
        database: 'dion',
        port: 3306
    };

    console.log(`Connecting to ${config.host}:${config.port}...`);
    
    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Connected to MySQL!');

        const [rows] = await connection.execute('DESCRIBE budget_reports');
        const hasStatus = rows.some(r => r.Field === 'status');

        if (!hasStatus) {
            console.log('Adding "status" column to budget_reports...');
            await connection.execute("ALTER TABLE budget_reports ADD COLUMN status VARCHAR(191) NOT NULL DEFAULT 'PENDING'");
            console.log('✅ Column added successfully!');
        } else {
            console.log('ℹ️ Column "status" already exists.');
        }

        await connection.end();
    } catch (e) {
        console.error('❌ Connection failed:', e.message);
        console.log('\n--- ALTERNATIVE ---');
        console.log('If you are using Docker, please run this command in your terminal:');
        console.log('docker exec -it dion_db_sikakyayasanumum mysql -u mysql -p7dff32cee8db81c86c80 dion -e "ALTER TABLE budget_reports ADD COLUMN status VARCHAR(191) NOT NULL DEFAULT \'PENDING\';"');
    }
}

repair();
