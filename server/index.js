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

app.use(cors());
app.use(express.json());

// Basic Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SIKAK Yayasan Umum API is running' });
});

// Initial Routes Placeholder
app.get('/api', (req, res) => {
    res.send('SIKAK Yayasan Umum Backend API');
});

// Serve Static Files (Vite Build)
const buildPath = path.join(__dirname, '../dist');
app.use(express.static(buildPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
