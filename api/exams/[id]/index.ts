
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db.js';
import { authLib } from '../../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // GET: Detail
    if (req.method === 'GET') {
        const exam = await db.exam.findUnique({
            where: { id },
            include: { questions: true }
        });

        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        if (!isAdmin && !exam.published) {
            return res.status(403).json({ error: 'Exam access denied' });
        }

        if (!isAdmin) {
            const sanitized = {
                ...exam,
                questions: exam.questions.map(q => ({
                    ...q,
                    correctAnswer: undefined
                }))
            };
            return res.status(200).json(sanitized);
        }

        return res.status(200).json(exam);
    }

    // PUT: Update
    if (req.method === 'PUT') {
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            const updates = req.body;
            delete updates.id;
            delete updates.createdAt;
            const updated = await db.exam.update({
                where: { id },
                data: { ...updates }
            });
            return res.status(200).json(updated);
        } catch (e) {
            return res.status(500).json({ error: 'Update failed' });
        }
    }

    // DELETE
    if (req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        await db.exam.delete({ where: { id } });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
