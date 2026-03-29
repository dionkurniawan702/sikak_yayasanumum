import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Verbose Diagnostic Log
const rawDBUrl = process.env.DATABASE_URL || '';
const maskedDBUrl = rawDBUrl.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[Diagnostic] Starting SIKAK Yayasan Backend...`);
console.log(`[Diagnostic] PORT: ${PORT}`);
console.log(`[Diagnostic] DATABASE_URL: ${maskedDBUrl}`);
console.log(`[Diagnostic] __dirname: ${__dirname}`);

app.use(cors());
app.use(express.json());

// Real-time Request Logger (for debugging)
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Immediate Root Health Check (Crucial for Easypanel)
app.get('/', (req, res) => {
    res.status(200).send('SIKAK Yayasan Umum Application is Running');
});

// Basic Health Check (Verifies Prisma)
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'connected', message: 'SIKAK Yayasan Umum API is running' });
    } catch (error) {
        console.error(`[DB Error] ${error.message}`);
        res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});

// Initial Routes Placeholder
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
});

const buildPath = path.join(__dirname, '../dist');
console.log(`[Diagnostic] Build path set to: ${buildPath}`);

// Static files (Defensive)
app.use(express.static(buildPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
    try {
        res.sendFile(path.join(buildPath, 'index.html'));
    } catch (error) {
        res.status(404).send('Frontend build (index.html) not found. Check Docker build logs.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (0.0.0.0)`);
});
