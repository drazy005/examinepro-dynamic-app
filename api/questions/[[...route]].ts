import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';
import { authLib } from '../_lib/auth';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { route } = req.query;
    // route is string[] | string | undefined

    // Auth Check
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    const role = user?.role as string;

    // Strict Admin Check for ALL question operations
    if (!user || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // === ROUTE: /api/questions (List, Create, Delete Query/Purge) ===
    if (!route || route.length === 0) {

        // GET: List
        if (req.method === 'GET') {
            try {
                const questions = await db.question.findMany({
                    orderBy: { createdAt: 'desc' }
                });
                return res.status(200).json(questions);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to fetch questions' });
            }
        }

        // POST: Create Single
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
                return res.status(500).json({ error: 'Failed to create question' });
            }
        }

        // DELETE: Query param delete or purge
        if (req.method === 'DELETE') {
            const { id, mode, type } = req.query;

            // Purge
            if (mode === 'purge') {
                const whereClause: any = {};
                if (type && type !== 'ALL') whereClause.type = type;
                const result = await db.question.deleteMany({ where: whereClause });
                return res.status(200).json({ success: true, count: result.count });
            }

            // Single Delete via Query
            if (id && typeof id === 'string') {
                await db.question.delete({ where: { id } });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ error: 'Missing ID or Mode' });
        }
    }

    // === ROUTE: /api/questions/batch ===
    if (route[0] === 'batch') {
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

    // === ROUTE: /api/questions/[id] ===
    const id = route[0];

    // PUT: Update
    if (req.method === 'PUT') {
        try {
            const { type, text, options, correctAnswer, points, category, imageUrl } = req.body;
            const updated = await db.question.update({
                where: { id },
                data: { type, text, options, correctAnswer, points, category, imageUrl }
            });
            return res.status(200).json(updated);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to update question' });
        }
    }

    // DELETE: Delete Single
    if (req.method === 'DELETE') {
        try {
            await db.question.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed to delete question' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
