import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    // GET: List Exams
    if (req.method === 'GET') {
        try {
            const exams = await db.exam.findMany({
                include: {
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            type: true,
                            options: true,
                            points: true,
                            // EXCLUDING correctAnswer for security in list view (though usually list doesn't include questions at all to save bandwidth)
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return res.status(200).json(exams);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch exams' });
        }
    }

    // POST: Create Exam
    if (req.method === 'POST') {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            const { questions, ...examData } = req.body;

            const newExam = await db.exam.create({
                data: {
                    ...examData,
                    questions: {
                        create: questions.map((q: any) => ({
                            type: q.type,
                            text: q.text,
                            options: q.options,
                            correctAnswer: q.correctAnswer, // Stored securely
                            points: q.points
                        }))
                    }
                },
                include: { questions: true }
            });
            return res.status(200).json(newExam);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to create exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
