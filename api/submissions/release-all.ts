
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') return res.status(403).json({ error: 'Access denied' });

    try {
        await db.submission.updateMany({
            where: { resultsReleased: false },
            data: { resultsReleased: true }
        });
        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: 'Failed' });
    }
}
