
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token || req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let user;
    try {
        user = authLib.verifyToken(token);
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method === 'PUT') {
        try {
            const { type, text, options, correctAnswer, points, category, imageUrl } = req.body;
            const updated = await db.question.update({
                where: { id },
                data: { type, text, options, correctAnswer, points, category, imageUrl }
            });
            return res.status(200).json(updated);
        } catch (e: any) {
            return res.status(500).json({ error: `Failed to update question: ${e.message}` });
        }
    }

    if (req.method === 'DELETE') {
        try {
            await db.question.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e: any) {
            return res.status(500).json({ error: `Failed to delete question: ${e.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
