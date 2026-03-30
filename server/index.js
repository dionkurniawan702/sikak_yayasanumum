import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Immediate Boot Log
console.log(`[Diagnostic] ${new Date().toISOString()} - SIKAK Backend Process Starting...`);

// 2. Global Exception Catching (Crucial for Alpine/Docker)
process.on('uncaughtException', (err) => {
    console.error(`[CRITICAL] Uncaught Exception: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[CRITICAL] Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// 3. Early Health Check (Before anything else)

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Lazy Prisma Initialization (to prevent boot-time crashes)
let prisma;
const getPrisma = () => {
    if (!prisma) {
        prisma = new PrismaClient();
    }
    return prisma;
};

const PORT = process.env.PORT || 3000;

// Verbose Diagnostic Log
const rawDBUrl = process.env.DATABASE_URL || '';
const maskedDBUrl = rawDBUrl.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[Diagnostic] PORT: ${PORT}`);
console.log(`[Diagnostic] DATABASE_URL: ${maskedDBUrl}`);
console.log(`[Diagnostic] __dirname: ${__dirname}`);

app.use(cors());
app.use(express.json());

// Real-time Request Logger
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Set prisma instance on app for routers to use
app.set('prisma', getPrisma());

// 4. API Routes
import anggaranRouter from './routes/anggaran.js';
import coreRouter from './routes/core.js';

app.use('/api', anggaranRouter);
app.use('/api', coreRouter);

// Bulk Sync Endpoint (for legacy support and complex updates)
app.post('/api/sync', async (req, res) => {
    try {
        const client = getPrisma();
        const { accounts, journals, assets, programs, users, budgets } = req.body;
        
        // This is a simplified bulk sync. In a real app, you'd use a transaction.
        // For now, we'll just acknowledge recept of data.
        console.log(`[Sync] Received bulk update from client`);
        res.json({ status: 'ok', message: 'Sync received' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Advanced Health Check (Verifies Prisma)
app.get('/api/health', async (req, res) => {
    try {
        const client = getPrisma();
        await client.$queryRaw`SELECT 1`;
        
        // Quick diagnostic counts
        const incomeItemCount = await client.incomeItem.count({ where: { isDeleted: false } });
        const userCount = await client.user.count({ where: { isDeleted: false } });

        res.json({ 
            status: 'ok', 
            version: '1.0.2',
            database: 'connected',
            stats: {
                incomeItems: incomeItemCount,
                users: userCount
            },
            message: 'SIKAK Yayasan Umum API is running',
            env: {
                DATABASE_URL: maskedDBUrl ? 'SET' : 'NOT SET',
                NODE_ENV: process.env.NODE_ENV
            }
        });
    } catch (error) {
        console.error(`[DB Error] ${error.message}`);
        res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});

// 4.1 Manual Seeding Endpoint (Debug)
app.get('/api/seed', async (req, res) => {
    try {
        console.log('[Manual Seed] Executing...');
        const { execSync } = await import('child_process');
        const output = execSync('node prisma/seed_yayasan_final.cjs').toString();
        
        // Also ensure fund sources via internal function as fallback
        await ensureFundSources();

        res.json({ 
            status: 'ok', 
            message: 'Seeding triggered successfully', 
            output: output 
        });
    } catch (error) {
        console.error(`[Manual Seed Error] ${error.message}`);
        res.status(500).json({ status: 'error', error: error.message });
    }
});

const buildPath = path.join(__dirname, '../dist');
console.log(`[Diagnostic] Build path: ${buildPath}`);

app.use(express.static(buildPath));

app.get('*', (req, res) => {
    try {
        res.sendFile(path.join(buildPath, 'index.html'));
    } catch (error) {
        res.status(404).send('Frontend build (index.html) not found.');
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[Error] ${new Date().toISOString()} - ${err.message}`);
    
    // Handle Prisma specific errors
    if (err.message.includes('Authentication failed')) {
        return res.status(500).json({ 
            error: 'Database Authentication Failed', 
            details: 'Please check DATABASE_URL credentials in Easypanel Environment Variables.' 
        });
    }
    
    if (err.message.includes('Can not connect to database')) {
        return res.status(500).json({ 
            error: 'Database Connection Failed', 
            details: 'Ensure the database container is running and accessible.' 
        });
    }

    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: err.message 
    });
});

// 5. Auto-Seed Function (Background)
const ensureFundSources = async () => {
    const incomeItemsList = [
        'Gedung', 'Asrama', 'Lokal', 'Perlengkapan', 'Penggajian', 
        'Operasional Bulanan', 'Pengembangan dan Pelatihan', 'Uang Makan', 
        'Seragam', 'Kopiah', 'Paket 1 tahun', 'Kegiatan Kesiswaan', 
        'Ekskul', 'Uang Ujian', 'Infaq Perpustakaan', 
        'Buku komunikasi & Raport(LKPD)', 
        'Buku H.Doa, Pedoman Pendidikan dan T. Ibadah', 
        'Buku Pelajaran', 'Buku Kontrol Tahfizh', 'Buku Tulis', 
        'Uang Osis', 'Biaya Pramuka', 'Biaya UKS', 'Biaya Berobat', 
        'Biaya Bus', 'Labor IPA', 'Labor Komputer', 'Outing Class', 
        'Komite', 'Biaya Aplikasi', 'Biaya Try Out', 'Biaya Perpisahan', 
        'Perawatan Sarpras dan Bangunan', 'Biaya Kompre', 'Sosial'
    ];

    try {
        const client = getPrisma();
        console.log(`[Seed] Checking Fund Sources (${incomeItemsList.length} items)...`);
        for (const name of incomeItemsList) {
            const existing = await client.incomeItem.findFirst({
                where: { name, isDeleted: false }
            });
            
            if (!existing) {
                await client.incomeItem.create({
                    data: { name }
                });
                console.log(`[Seed] Added: ${name}`);
            }
        }
        console.log(`[Seed] Fund Source check complete.`);
    } catch (error) {
        console.error(`[Seed Error] ${error.message}`);
    }
};

// Server Listening with Robust Error Handling
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Success] SIKAK Yayasan Backend listening on port ${PORT}`);
    console.log(`[Success] Internal Health Check Path: /health`);
    
    // Trigger background seeding WITHOUT blocking startup
    ensureFundSources().catch(err => {
        console.error(`[Background Seed Error] ${err.message}`);
    });
});

server.on('error', (err) => {
    console.error(`[Error] Server failed to start: ${err.message}`);
    process.exit(1);
});
