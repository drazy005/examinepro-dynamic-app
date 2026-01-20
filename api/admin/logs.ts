import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);

    if (!user || user.role !== UserRole.SUPERADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method === 'GET') {
        try {
            const logs = await db.auditLog.findMany({
                take: 200,
                orderBy: { timestamp: 'desc' },
                include: { user: { select: { name: true, email: true } } }
            });
            // Flatten for frontend compatibility if needed, or update frontend types
            // The current frontend expects AuditLog interface
            return res.status(200).json(logs.map(l => ({
                ...l,
                timestamp: l.timestamp.getTime(), // Convert Date to number for existing frontend compat
                userName: l.user.name
            })));
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch logs' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
