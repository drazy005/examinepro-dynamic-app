
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

    // Parse Route
    const { route, mode, action } = req.query;
    const pathId = Array.isArray(route) ? route[0] : (typeof route === 'string' ? route : null);

    // Handlers for Specific ID (GET Detail, PUT Update, DELETE, POST Actions)
    if (pathId) {
        // ACTION: Release Results (POST /api/exams/123?action=release)
        if (req.method === 'POST' && action === 'release') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                await db.submission.updateMany({
                    where: { examId: pathId },
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
                    where: { id: pathId },
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
                    where: { id: pathId },
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

                if (createdAt) {
                    updateData.createdAt = typeof createdAt === 'number' ? new Date(createdAt) : createdAt;
                }

                Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

                if (questions && Array.isArray(questions)) {
                    updateData.questions = {
                        set: questions.filter((q: any) => q && q.id).map((q: any) => ({ id: q.id }))
                    };
                }

                if (collaborators && Array.isArray(collaborators)) {
                    updateData.collaborators = {
                        set: collaborators.filter((c: any) => c && c.id).map((c: any) => ({ id: c.id }))
                    };
                }

                const updated = await db.exam.update({
                    where: { id: pathId },
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
                const exam = await db.exam.findUnique({ where: { id: pathId } });
                if (!exam) return res.status(404).json({ error: 'Exam not found' });

                const isAuthor = exam.authorId === user.userId;
                const isSuperAdmin = user.role === 'SUPERADMIN';

                if (!isAdmin || (!isAuthor && !isSuperAdmin)) {
                    return res.status(403).json({ error: 'Access denied' });
                }

                await db.exam.delete({ where: { id: pathId } });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Delete failed' });
            }
        }

        return res.status(405).json({ error: 'Method not allowed for ID' });
    }

    // === LIST / CREATE (No ID in Route) ===

    // GET: List
    if (req.method === 'GET') {
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
                showMcqScoreImmediately, resultRelease, createdAt
            } = req.body;

            const questionConnect = questions && Array.isArray(questions)
                ? questions.filter((q: any) => q && q.id).map((q: any) => ({ id: q.id }))
                : [];

            const collaboratorConnect = collaborators && Array.isArray(collaborators)
                ? collaborators.filter((c: any) => c && c.id).map((c: any) => ({ id: c.id }))
                : [];

            const createData: any = {
                title: title || 'Untitled Exam',
                description: description || '',
                category: category || 'General',
                difficulty: difficulty || 'MEDIUM',
                durationMinutes: Number(durationMinutes) || 30,
                timerSettings: timerSettings || {},
                gradingPolicy: gradingPolicy || {},
                published: published !== undefined ? published : false,
                resultRelease: resultRelease || 'INSTANT',

                passMark: passMark !== undefined ? Number(passMark) : 50,
                totalPoints: totalPoints !== undefined ? Number(totalPoints) : 0,
                warningTimeThreshold: warningTimeThreshold !== undefined ? Number(warningTimeThreshold) : 5,
                resultReleaseMode: resultReleaseMode || 'MANUAL',
                showMcqScoreImmediately: showMcqScoreImmediately || false,

                // @ts-ignore
                author: { connect: { id: user.userId } },
                questions: { connect: questionConnect },
                // @ts-ignore
                collaborators: { connect: collaboratorConnect }
            };

            if (scheduledReleaseDate) {
                createData.scheduledReleaseDate = typeof scheduledReleaseDate === 'number'
                    ? new Date(scheduledReleaseDate)
                    : scheduledReleaseDate;
            }

            Object.keys(createData).forEach(key => {
                if (createData[key] === undefined) delete createData[key];
            });

            const exam = await db.exam.create({
                data: createData,
                include: { questions: true }
            });
            return res.status(200).json(exam);
        } catch (e: any) {
            console.error("Exam Creation Failed:", e);
            return res.status(500).json({ error: `Create Failed. AuthorID: ${user?.userId}. Error: ${e.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
