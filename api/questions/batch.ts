
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // DELETE BATCH
    if (req.method === 'DELETE') {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid payload' });

        try {
            const result = await db.question.deleteMany({ where: { id: { in: ids } } });
            return res.status(200).json({ success: true, count: result.count });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // POST IMPORT
    if (req.method === 'POST') {
        const questions = req.body;
        if (!Array.isArray(questions)) return res.status(400).json({ error: 'Invalid payload' });

        const validQuestions = questions.map((q: any) => ({
            type: q.type || 'MCQ',
            text: q.text || 'Untitled Question',
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            points: q.points || 1,
            examId: q.examId || undefined
        }));

        try {
            const result = await db.question.createMany({ data: validQuestions });
            return res.status(200).json({ success: true, count: result.count });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
