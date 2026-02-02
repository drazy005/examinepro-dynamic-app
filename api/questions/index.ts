import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);

    // Check for ADMIN or SUPERADMIN
    const role = user.role as string;
    if (!user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // DELETE: Delete Question or Purge
    if (req.method === 'DELETE') {
        const { id, mode, type } = req.query;

        // Global/Filtered Purge
        if (mode === 'purge') {
            const whereClause: any = {};
            if (type && type !== 'ALL') {
                whereClause.type = type;
            }
            const result = await db.question.deleteMany({ where: whereClause });
            return res.status(200).json({ success: true, count: result.count });
        }

        // Single Delete
        if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

        await db.question.delete({ where: { id } });
        return res.status(200).json({ success: true });
    }

    // GET: List Questions
    if (req.method === 'GET') {
        const questions = await db.question.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(questions);
    }

    // POST: Create Question (Independent of Exam)
    if (req.method === 'POST') {
        try {
            const { type, text, options, correctAnswer, points, category, imageUrl } = req.body;

            const q = await db.question.create({
                data: {
                    type: type || 'MCQ',
                    text: text || 'New Question',
                    options: options || [],
                    correctAnswer: correctAnswer || '',
                    points: points || 1,
                    category,
                    imageUrl
                }
            });
            return res.status(200).json(q);
        } catch (e) {
            console.error('Create Question Error:', e);
            return res.status(500).json({ error: 'Failed to create question' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
