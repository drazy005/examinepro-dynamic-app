import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);

    // Check for ADMIN, TUTOR, or SUPERADMIN
    const role = user.role as string;
    if (!user || (role !== 'ADMIN' && role !== 'TUTOR' && role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // DELETE: Delete Question
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid ID' });

        await db.question.delete({ where: { id } });
        return res.status(200).json({ success: true });
    }

    // POST: Create/Update Question (Independent of Exam)
    if (req.method === 'POST') {
        // Use this for adding questions to the bank directly
        const data = req.body;
        const q = await db.question.create({
            data: {
                ...data,
                correctAnswer: data.correctAnswer // Stored securely
            }
        });
        return res.status(200).json(q);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
