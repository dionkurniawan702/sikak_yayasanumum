import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

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
app.get('/', (req, res) => {
    res.send('SIKAK Yayasan Umum Backend API');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
