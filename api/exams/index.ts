
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // GET: List
    if (req.method === 'GET') {
        const { mode } = req.query; // ?mode=available
        if (mode === 'available') {
            const exams = await db.exam.findMany({
                where: {
                    published: true,
                    // Exclude exams where this user has a submission
                    submissions: {
                        none: {
                            userId: user.userId
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
                // select/include nothing for questions to keep list lightweight
            });
            return res.status(200).json(exams);
        }

        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        const exams = await db.exam.findMany({
            orderBy: { createdAt: 'desc' },
            include: { questions: { select: { id: true } } }
        });
        return res.status(200).json(exams);
    }

    // POST: Create
    if (req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            const { title, description, category, difficulty, durationMinutes, timerSettings, gradingPolicy, questions, published } = req.body;

            const questionConnect = questions && Array.isArray(questions)
                ? questions.map((q: any) => ({ id: q.id }))
                : [];

            const exam = await db.exam.create({
                data: {
                    title: title || 'Untitled Exam',
                    description: description || '',
                    category: category || 'General',
                    difficulty: difficulty || 'MEDIUM',
                    durationMinutes: durationMinutes || 30,
                    timerSettings: timerSettings || {},
                    gradingPolicy: gradingPolicy || {},
                    published: published !== undefined ? published : false, // Respect payload, default to false
                    resultRelease: 'INSTANT',
                    questions: {
                        connect: questionConnect
                    }
                },
                include: {
                    questions: true
                }
            });
            return res.status(200).json(exam);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to create exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
