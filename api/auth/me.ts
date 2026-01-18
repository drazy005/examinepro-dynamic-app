import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../lib/db';
import { authLib } from '../../lib/auth';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) {
        return res.status(401).json({ error: 'No session' });
    }

    const payload = authLib.verifyToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        const user = await db.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isVerified: true
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error('Session error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
