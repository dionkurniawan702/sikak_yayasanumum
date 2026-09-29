import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sikad-dareliman-secret-2026';

const getPrisma = (req) => req.app.get('prisma');

// Middleware: Hanya Superadmin yang boleh mengakses riwayat Audit Log
export const requireSuperAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ error: 'Akses ditolak: Hanya Superadmin yang dapat mengakses Jejak Aktivitas (Audit Trail).' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
    }
};

// Middleware: User terautentikasi (semua role)
export const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
    }
};

/**
 * Helper Universal untuk mencatat Audit Log ke Database
 */
export async function recordAudit(prisma, {
    req = null,
    userId = null,
    userName = null,
    userRole = null,
    unitName = null,
    action = 'UNKNOWN',
    entity = 'General',
    entityId = null,
    details = {}
}) {
    try {
        if (!prisma) return;

        let uId = userId;
        let uName = userName;
        let uRole = userRole;
        let uUnit = unitName;
        let ip = null;

        if (req) {
            ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
            if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();

            if (!uId && req.user) {
                uId = req.user.id;
                uName = uName || req.user.username || req.user.name;
                uRole = uRole || req.user.role;
            }
        }

        // Jika ada userId tapi belum lengkap nama/unit, coba lookup singkat
        if (uId && (!uName || !uUnit)) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: uId },
                    include: { unit: true, field: true }
                });
                if (user) {
                    uName = uName || user.name || user.username;
                    uRole = uRole || user.role;
                    uUnit = uUnit || user.unit?.name || user.field?.name || (user.role === 'superadmin' ? 'Yayasan' : null);
                }
            } catch (e) {
                // Ignore lookup errors
            }
        }

        const detailsObj = typeof details === 'object' && details !== null 
            ? { ...details } 
            : { message: String(details || '') };

        if (uName) detailsObj.operatorName = uName;
        if (uRole) detailsObj.operatorRole = uRole;
        if (uUnit) detailsObj.operatorUnit = uUnit;
        if (ip) detailsObj.ipAddress = ip;

        await prisma.auditLog.create({
            data: {
                userId: uId || null,
                action: String(action || 'UNKNOWN').toUpperCase(),
                entity: String(entity || 'General'),
                entityId: entityId ? String(entityId) : null,
                details: detailsObj
            }
        });
    } catch (err) {
        console.error(`[Audit Log Failed] ${action} ${entity}: ${err.message}`);
    }
}

// GET /api/audit-logs - Ambil riwayat audit log dengan pagination dan filtering
router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const {
            page = 1,
            limit = 50,
            action,
            entity,
            search,
            startDate,
            endDate
        } = req.query;

        const take = Math.min(Math.max(parseInt(limit, 10) || 50, 10), 200);
        const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

        const where = {};
        if (action && action !== 'ALL') {
            where.action = action;
        }
        if (entity && entity !== 'ALL') {
            where.entity = entity;
        }
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.timestamp.lte = end;
            }
        }

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                take,
                skip
            })
        ]);

        // Kumpulkan user ID yang belum memiliki nama di details
        const missingUserIds = [...new Set(logs.filter(l => !l.details?.operatorName && l.userId).map(l => l.userId))];
        let userMap = new Map();
        if (missingUserIds.length > 0) {
            try {
                const users = await prisma.user.findMany({
                    where: { id: { in: missingUserIds } },
                    include: { unit: true, field: true }
                });
                users.forEach(u => userMap.set(u.id, u));
            } catch (e) {}
        }

        let enrichedLogs = logs.map(l => {
            const details = l.details || {};
            const u = l.userId ? userMap.get(l.userId) : null;
            return {
                id: l.id,
                userId: l.userId,
                action: l.action,
                entity: l.entity,
                entityId: l.entityId,
                timestamp: l.timestamp,
                details: details,
                operatorName: details.operatorName || u?.name || u?.username || 'Sistem',
                operatorRole: details.operatorRole || u?.role || 'system',
                operatorUnit: details.operatorUnit || u?.unit?.name || u?.field?.name || (u?.role === 'superadmin' ? 'Yayasan' : '—')
            };
        });

        // Filter text search di memori jika ada kata kunci
        if (search && search.trim()) {
            const q = search.toLowerCase();
            enrichedLogs = enrichedLogs.filter(l => {
                const text = `${l.action} ${l.entity} ${l.entityId || ''} ${l.operatorName} ${l.operatorUnit} ${JSON.stringify(l.details)}`.toLowerCase();
                return text.includes(q);
            });
        }

        res.json({
            success: true,
            data: enrichedLogs,
            pagination: {
                total,
                page: parseInt(page, 10) || 1,
                limit: take,
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('[API Error] GET /audit-logs:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/audit-logs - Untuk frontend mencatat aksi khusus (misal unduh laporan, cetak, dll)
router.post('/audit-logs', requireAuth, async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { action, entity, entityId, details } = req.body;

        await recordAudit(prisma, {
            req,
            action,
            entity,
            entityId,
            details
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/audit-logs/clear - Superadmin membersihkan log lama (opsional)
router.delete('/audit-logs/clear', requireSuperAdmin, async (req, res) => {
    try {
        const prisma = getPrisma(req);
        const { days = 90 } = req.query;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(days, 10));

        const result = await prisma.auditLog.deleteMany({
            where: {
                timestamp: { lt: cutoff }
            }
        });

        await recordAudit(prisma, {
            req,
            action: 'DELETE',
            entity: 'AuditLog',
            details: { message: `Superadmin membersihkan ${result.count} baris log audit yang lebih lama dari ${days} hari` }
        });

        res.json({ success: true, deletedCount: result.count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
