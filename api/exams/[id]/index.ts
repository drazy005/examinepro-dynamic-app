
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db.js';
import { authLib } from '../../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // === ACTIONS (POST) ===
    if (req.method === 'POST') {
        if (action === 'release') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                // Release all submissions for this exam
                await db.submission.updateMany({
                    where: { examId: id },
                    data: { resultsReleased: true }
                });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Failed to release results' });
            }
        }
        return res.status(400).json({ error: 'Invalid action' });
    }

    // === STANDARD OPERATIONS ===

    // GET: Detail
    if (req.method === 'GET') {
        const exam = await db.exam.findUnique({
            where: { id },
            include: { questions: true }
        });

        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        if (!isAdmin && !exam.published) {
            return res.status(403).json({ error: 'Exam access denied' });
        }

        if (!isAdmin) {
            const sanitized = {
                ...exam,
                questions: exam.questions.map(q => ({
                    ...q,
                    correctAnswer: undefined
                }))
            };
            return res.status(200).json(sanitized);
        }

        return res.status(200).json(exam);
    }

    // PUT: Update
    if (req.method === 'PUT') {
        try {
            const exam = await db.exam.findUnique({
                where: { id },
                include: { collaborators: { select: { id: true } } }
            });

            if (!exam) return res.status(404).json({ error: 'Exam not found' });

            // Permission Check: Author OR Collaborator OR SuperAdmin
            const isAuthor = exam.authorId === user.userId;
            const isCollaborator = exam.collaborators.some(c => c.id === user.userId);
            const isSuperAdmin = user.role === 'SUPERADMIN';

            if (!isAdmin || (!isAuthor && !isCollaborator && !isSuperAdmin)) {
                return res.status(403).json({ error: 'Access denied: You are not an author or collaborator.' });
            }

            const { id: _id, createdAt: _created, questions, author, collaborators, ...scalars } = req.body;

            // Prepare update data
            const updateData: any = { ...scalars };

            // Handle Questions Update (Many-to-Many: Re-link)
            if (questions && Array.isArray(questions)) {
                updateData.questions = {
                    set: questions.map((q: any) => ({ id: q.id })) // Replace all links with new set
                };
            }

            const updated = await db.exam.update({
                where: { id },
                data: updateData
            });
            return res.status(200).json(updated);
        } catch (e: any) {
            console.error("Exam Update Error:", e);
            return res.status(500).json({ error: 'Update failed: ' + e.message });
        }
    }

    // DELETE
    if (req.method === 'DELETE') {
        try {
            const exam = await db.exam.findUnique({ where: { id } });
            if (!exam) return res.status(404).json({ error: 'Exam not found' });

            // Permission Check: Author OR SuperAdmin ONLY (Collaborators cannot delete)
            const isAuthor = exam.authorId === user.userId;
            const isSuperAdmin = user.role === 'SUPERADMIN';

            if (!isAdmin || (!isAuthor && !isSuperAdmin)) {
                return res.status(403).json({ error: 'Access denied: Only the author can delete this exam.' });
            }

            await db.exam.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Delete failed' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
