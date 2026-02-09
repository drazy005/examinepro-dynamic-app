
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


    // === SINGLE ID OPERATIONS ===
    const { id, mode, action } = req.query;

    if (id && typeof id === 'string') {
        // ACTION: Release Results
        if (req.method === 'POST' && action === 'release') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                await db.submission.updateMany({
                    where: { examId: id },
                    data: { resultsReleased: true }
                });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Failed to release results' });
            }
        }

        // GET: Detail
        if (req.method === 'GET') {
            try {
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
            } catch (e) {
                return res.status(500).json({ error: 'Failed to fetch exam' });
            }
        }

        // PUT: Update
        if (req.method === 'PUT') {
            try {
                const exam = await db.exam.findUnique({
                    where: { id },
                    include: { collaborators: { select: { id: true } } }
                });

                if (!exam) return res.status(404).json({ error: 'Exam not found' });

                // @ts-ignore
                const isAuthor = exam.authorId === user.userId;
                // @ts-ignore
                const isCollaborator = exam.collaborators.some(c => c.id === user.userId);
                const isSuperAdmin = user.role === 'SUPERADMIN';

                if (!isAdmin || (!isAuthor && !isCollaborator && !isSuperAdmin)) {
                    return res.status(403).json({ error: 'Access denied' });
                }

                const {
                    title, description, category, difficulty, durationMinutes,
                    warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                    showMcqScoreImmediately, passMark, totalPoints, published,
                    version, resultRelease, reviewed, timerSettings, gradingPolicy,
                    questions, collaborators, createdAt
                } = req.body;

                const updateData: any = {
                    title, description, category, difficulty, durationMinutes,
                    warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                    showMcqScoreImmediately, passMark, totalPoints, published,
                    version, resultRelease, reviewed, timerSettings, gradingPolicy
                };

                // Explicit field conversions
                if (createdAt) {
                    // If frontend sends timestamp (number), convert to Date
                    // If string, let Prisma handle or ensure ISO
                    updateData.createdAt = typeof createdAt === 'number' ? new Date(createdAt) : createdAt;
                }

                // Remove undefined keys
                Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);


                if (questions && Array.isArray(questions)) {
                    updateData.questions = {
                        set: questions.map((q: any) => ({ id: q.id }))
                    };
                }

                if (collaborators && Array.isArray(collaborators)) {
                    updateData.collaborators = {
                        set: collaborators.map((c: any) => ({ id: c.id }))
                    };
                }

                const updated = await db.exam.update({
                    where: { id },
                    data: updateData
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                console.error("Exam Update Failed:", e);
                return res.status(500).json({ error: 'Update failed: ' + e.message });
            }
        }

        // DELETE: Single
        if (req.method === 'DELETE') {
            try {
                const exam = await db.exam.findUnique({ where: { id } });
                if (!exam) return res.status(404).json({ error: 'Exam not found' });

                const isAuthor = exam.authorId === user.userId;
                const isSuperAdmin = user.role === 'SUPERADMIN';

                if (!isAdmin || (!isAuthor && !isSuperAdmin)) {
                    return res.status(403).json({ error: 'Access denied' });
                }

                await db.exam.delete({ where: { id } });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Delete failed' });
            }
        }
    }

    // === LIST / CREATE OPERATIONS ===

    // GET: List
    if (req.method === 'GET') {
        // const { mode } = req.query; // pulled up
        if (mode === 'available') {
            const exams = await db.exam.findMany({
                where: {
                    published: true,
                    submissions: {
                        none: { userId: user.userId }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return res.status(200).json(exams);
        }

        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        const exams = await db.exam.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                questions: { select: { id: true } },
                author: { select: { id: true, name: true, email: true } },
                collaborators: { select: { id: true, name: true, email: true } }
            }
        });
        return res.status(200).json(exams);
    }

    // POST: Create
    if (req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            const {
                title, description, category, difficulty, durationMinutes,
                timerSettings, gradingPolicy, questions, published,
                collaborators, passMark, totalPoints,
                warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                showMcqScoreImmediately, resultRelease
            } = req.body;

            const questionConnect = questions && Array.isArray(questions)
                ? questions.map((q: any) => ({ id: q.id }))
                : [];

            const collaboratorConnect = collaborators && Array.isArray(collaborators)
                ? collaborators.map((c: any) => ({ id: c.id }))
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
                    published: published !== undefined ? published : false,
                    resultRelease: resultRelease || 'INSTANT',

                    // Add missing fields to create that were available in schema
                    passMark: passMark !== undefined ? passMark : 50,
                    totalPoints: totalPoints || 0,
                    warningTimeThreshold: warningTimeThreshold || 5,
                    resultReleaseMode: resultReleaseMode || 'MANUAL',
                    scheduledReleaseDate: scheduledReleaseDate,
                    showMcqScoreImmediately: showMcqScoreImmediately || false,

                    author: { connect: { id: user.userId } },
                    questions: { connect: questionConnect },
                    collaborators: { connect: collaboratorConnect }
                },
                include: { questions: true }
            });
            return res.status(200).json(exam);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to create exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
