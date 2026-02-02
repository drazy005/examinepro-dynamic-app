import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

    // Auth Check
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    const role = user.role as string;
    if (!user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        // DELETE BATCH
        if (req.method === 'DELETE') {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids)) {
                return res.status(400).json({ error: 'Invalid payload: Expected { ids: string[] }' });
            }
            const result = await db.question.deleteMany({
                where: { id: { in: ids } }
            });
            return res.status(200).json({ success: true, count: result.count });
        }

        // POST IMPORT
        const questions = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Invalid payload: Expected array of questions' });
        }

        // Validate basic structure
        // Validate and insert
        // Since sqlite/some providers don't support createMany with relations well or we might need individual IDs?
        // Prisma `createMany` is supported in Postgres.

        const validQuestions = questions.map(q => ({
            type: q.type || 'MCQ',
            text: q.text || 'Untitled Question',
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            points: q.points || 1,
            // examId is optional in schema (String?), so undefined/null is fine.
            // But we must NOT pass empty string if it expects nullable relation.
            // If q.examId is missing, leave it undefined.
            examId: q.examId || undefined
        }));

        const result = await db.question.createMany({
            data: validQuestions as any
        });

        return res.status(200).json({ success: true, count: result.count });

    } catch (error: any) {
        console.error('Batch error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
