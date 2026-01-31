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
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const user = authLib.verifyToken(token);
    const role = user?.role as string;
    if (!user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // PUT: Update Question
    if (req.method === 'PUT') {
        try {
            const { type, text, options, correctAnswer, points, category, imageUrl } = req.body;

            const updated = await db.question.update({
                where: { id },
                data: {
                    type,
                    text,
                    options,
                    correctAnswer, // Securely updated
                    points,
                    category,
                    imageUrl
                }
            });
            return res.status(200).json(updated);
        } catch (e) {
            console.error('Update Question Error:', e);
            return res.status(500).json({ error: 'Failed to update question' });
        }
    }

    // DELETE: Delete Question
    if (req.method === 'DELETE') {
        try {
            await db.question.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed to delete question' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
