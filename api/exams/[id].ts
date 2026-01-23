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
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = role === 'ADMIN' || role === 'TUTOR' || role === 'SUPERADMIN';

    // GET: Fetch Exam Details
    if (req.method === 'GET') {
        try {
            const exam = await db.exam.findUnique({
                where: { id },
                include: {
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            type: true,
                            options: true,
                            points: true,
                            // precise behavior: don't reveal correctAnswer to candidates here unless verified flow
                            // For now, only Admins get correct answers via this specific endpoint? 
                            // Or standard behavior: do NOT send correctAnswer to client.
                        }
                    }
                }
            });

            if (!exam) return res.status(404).json({ error: 'Exam not found' });

            // If Candidate, ensure it is published
            if (!isAdmin && !exam.published) {
                return res.status(403).json({ error: 'Exam is not available' });
            }

            return res.status(200).json(exam);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch exam' });
        }
    }

    // PUT: Update Exam
    if (req.method === 'PUT') {
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

        try {
            const { questions, ...data } = req.body;

            // 1. Update Exam fields
            const updatedExam = await db.exam.update({
                where: { id },
                data: { ...data }
            });

            // 2. Handle Questions (upsert/delete logic is complex, simpler to expect full replacement or separate question API)
            // For MVP refactor: We won't auto-update questions here to avoid accidental data loss. 
            // Questions should be managed via /api/questions or if the client sends a full set?
            // Let's stick to updating non-relational fields here for safety unless explicitly requested.
            // If the user wants to update questions, they probably use the dedicated question management UI. 

            return res.status(200).json(updatedExam);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to update exam' });
        }
    }

    // DELETE: Delete Exam
    if (req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

        try {
            await db.exam.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed to delete exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
