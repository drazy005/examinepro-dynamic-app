
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    console.log(`[Exams] Method: ${req.method}, Query: ${JSON.stringify(req.query)}`);
    console.log(`[Exams] Token present: ${!!token}, Cookie length: ${req.headers.cookie?.length || 0}`);

    if (!token) {
        console.warn('[Exams] No token provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = authLib.verifyToken(token);
    if (!user) {
        console.warn('[Exams] Invalid token');
        return res.status(401).json({ error: 'Invalid token' });
    }

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // GET: List
    if (req.method === 'GET') {
        const { mode } = req.query; // ?mode=available
        if (mode === 'available') {
            const exams = await db.exam.findMany({
                where: { published: true },
                orderBy: { createdAt: 'desc' },
                include: { questions: false }
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
            const { title, description, category, difficulty, durationMinutes, timerSettings, gradingPolicy } = req.body;
            const exam = await db.exam.create({
                data: {
                    title: title || 'Untitled Exam',
                    description: description || '',
                    category: category || 'General',
                    difficulty: difficulty || 'MEDIUM',
                    durationMinutes: durationMinutes || 30,
                    timerSettings: timerSettings || {},
                    gradingPolicy: gradingPolicy || {},
                    published: false,
                    resultRelease: 'INSTANT'
                }
            });
            return res.status(200).json(exam);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to create exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
