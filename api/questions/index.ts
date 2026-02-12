
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const role = (user.role as string).toUpperCase();
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { action, id, mode, type } = req.query;

    // === BATCH OPERATIONS ===
    if (action === 'batch') {
        // DELETE BATCH
        if (req.method === 'DELETE') {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid payload' });

            try {
                const result = await db.question.deleteMany({ where: { id: { in: ids } } });
                return res.status(200).json({ success: true, count: result.count });
            } catch (e: any) {
                return res.status(500).json({ error: e.message });
            }
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
                // examId removed as it's not in the model anymore (Many-to-Many)
            }));

            try {
                const result = await db.question.createMany({ data: validQuestions });
                return res.status(200).json({ success: true, count: result.count });
            } catch (e: any) {
                return res.status(500).json({ error: e.message });
            }
        }
        return res.status(405).json({ error: 'Method not allowed for batch' });
    }

    // === SINGLE ID OPERATIONS (Logic merged from [id].ts) ===
    if (id && typeof id === 'string') {
        // PUT: Update
        if (req.method === 'PUT') {
            try {
                const question = await db.question.findUnique({
                    where: { id },
                    include: { collaborators: { select: { id: true } } }
                });

                if (!question) return res.status(404).json({ error: 'Question not found' });

                // Permission Check
                // @ts-ignore
                const isAuthor = question.authorId === user.userId;
                // @ts-ignore
                const isCollaborator = question.collaborators.some(c => c.id === user.userId);
                const isSuperAdmin = user.role === 'SUPERADMIN';

                if (!isAuthor && !isCollaborator && !isSuperAdmin) {
                    return res.status(403).json({ error: 'Access denied' });
                }

                const { type, text, options, correctAnswer, points, category, imageUrl, collaborators } = req.body;

                // Construct update data
                const updateData: any = { type, text, options, correctAnswer, points, category, imageUrl };

                // Clean undefined
                Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

                // Handle Collaborators Update (if provided)
                if (collaborators && Array.isArray(collaborators)) {
                    updateData.collaborators = {
                        set: collaborators.filter((c: any) => c && (c.id || c)).map((c: any) => ({ id: c.id || c }))
                    };
                }

                const updated = await db.question.update({
                    where: { id },
                    data: updateData
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                return res.status(500).json({ error: `Failed to update question: ${e.message}` });
            }
        }

        // DELETE: Single
        if (req.method === 'DELETE') {
            try {
                const question = await db.question.findUnique({ where: { id } });
                if (!question) return res.status(404).json({ error: 'Question not found' });

                // Permission Check: Author OR SuperAdmin ONLY
                // @ts-ignore
                const isAuthor = question.authorId === user.userId;
                const isSuperAdmin = user.role === 'SUPERADMIN';

                if (!isAuthor && !isSuperAdmin) {
                    return res.status(403).json({ error: 'Access denied: Only author can delete.' });
                }

                await db.question.delete({ where: { id } });
                return res.status(200).json({ success: true });
            } catch (e: any) {
                return res.status(500).json({ error: `Failed to delete question: ${e.message}` });
            }
        }
    }

    // === STANDARD OPERATIONS ===

    // GET: List
    if (req.method === 'GET') {
        try {
            const questions = await db.question.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    exams: { select: { title: true } },
                    // @ts-ignore
                    author: { select: { id: true, name: true } },
                    // @ts-ignore
                    collaborators: { select: { id: true, name: true } }
                }
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
            const { type, text, options, correctAnswer, points, category, imageUrl, collaborators } = req.body;

            const createData: any = {
                type: type || 'MCQ',
                text: text || 'New Question',
                options: options || [],
                correctAnswer: correctAnswer || '',
                points: points || 1,
                category,
                imageUrl,
                author: { connect: { id: user.userId } }
            };

            if (collaborators && Array.isArray(collaborators)) {
                createData.collaborators = {
                    connect: collaborators.filter((c: any) => c && (c.id || c)).map((c: any) => ({ id: c.id || c }))
                };
            }

            const q = await db.question.create({
                data: createData,
                include: { author: true, collaborators: true }
            });
            return res.status(200).json(q);
        } catch (e: any) {
            return res.status(500).json({ error: `Failed to create question: ${e.message}` });
        }
    }

    // DELETE: Purge (SuperAdmin Only)
    if (req.method === 'DELETE' && mode === 'purge') {
        if (user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'SuperAdmin only' });

        const whereClause: any = {};
        if (type && type !== 'ALL') whereClause.type = type;
        await db.question.deleteMany({ where: whereClause });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
