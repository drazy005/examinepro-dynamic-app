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

    // DELETE: Delete Question
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid ID' });

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
