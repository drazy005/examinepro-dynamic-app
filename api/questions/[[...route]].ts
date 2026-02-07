
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { route } = req.query;
    // route is string[] | string | undefined

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
    // Strict Admin Check for ALL question operations
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // === 1. ROOT ROUTES: /api/questions ===
    if (!route || route.length === 0) {

        // GET: List
        if (req.method === 'GET') {
            try {
                const questions = await db.question.findMany({
                    orderBy: { createdAt: 'desc' },
                    include: { exam: { select: { title: true } } } // Nice to have exam title
                });
                return res.status(200).json(questions);
            } catch (e: any) {
                console.error('Questions fetch error:', e);
                return res.status(500).json({ error: `Failed to fetch questions: ${e.message}` });
            }
        }

        // POST: Create
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
            } catch (e: any) {
                return res.status(500).json({ error: `Failed to create question: ${e.message}` });
            }
        }

        // DELETE: Query param delete or purge
        if (req.method === 'DELETE') {
            const { id, mode, type } = req.query;

            // Purge
            if (mode === 'purge') {
                const whereClause: any = {};
                if (type && type !== 'ALL') whereClause.type = type;
                await db.question.deleteMany({ where: whereClause });
                return res.status(200).json({ success: true });
            }

            // Single Delete via Query
            if (id && typeof id === 'string') {
                await db.question.delete({ where: { id } });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ error: 'Missing ID or Mode' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actionOrId = route[0];

    // === 2. BATCH ROUTES ===
    if (actionOrId === 'batch') {
        // DELETE BATCH
        if (req.method === 'DELETE') {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid payload' });

            const result = await db.question.deleteMany({ where: { id: { in: ids } } });
            return res.status(200).json({ success: true, count: result.count });
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

    // === 3. ID ROUTES ===
    const id = actionOrId;

    if (req.method === 'PUT') {
        try {
            const { type, text, options, correctAnswer, points, category, imageUrl } = req.body;
            const updated = await db.question.update({
                where: { id },
                data: { type, text, options, correctAnswer, points, category, imageUrl }
            });
            return res.status(200).json(updated);
        } catch (e: any) {
            return res.status(500).json({ error: `Failed to update question: ${e.message}` });
        }
    }

    if (req.method === 'DELETE') {
        try {
            await db.question.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e: any) {
            return res.status(500).json({ error: `Failed to delete question: ${e.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
