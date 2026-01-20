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

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method === 'GET') {
        try {
            const users = await db.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isVerified: true,
                    lastActive: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            });
            return res.status(200).json(users);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
