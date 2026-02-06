import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';
import { authLib } from '../_lib/auth';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { route } = req.query;
    // route is string[] | string | undefined
    // If undefined or empty -> /api/exams/ (Index)
    // If 1 element -> /api/exams/[id] (Detail)

    // Auth Check
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    const role = user.role as string;
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

    // === ROUTE: /api/exams (List / Create) ===
    if (!route || route.length === 0) {
        // GET: List Exams
        if (req.method === 'GET') {
            const { mode } = req.query;
            try {
                if (mode === 'available') {
                    // Candidate View
                    const now = new Date();
                    const availableExams = await db.exam.findMany({
                        where: {
                            published: true,
                            OR: [
                                { scheduledReleaseDate: null },
                                { scheduledReleaseDate: { lte: now } }
                            ]
                        },
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            category: true,
                            difficulty: true,
                            durationMinutes: true,
                            totalPoints: true,
                        },
                        orderBy: { createdAt: 'desc' }
                    });
                    return res.status(200).json(availableExams);
                }

                // Admin View
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

                const exams = await db.exam.findMany({
                    include: {
                        questions: {
                            select: {
                                id: true,
                                text: true,
                                type: true,
                                options: true,
                                points: true,
                                correctAnswer: true,
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
            if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

            try {
                const {
                    title, description, category, difficulty, durationMinutes,
                    warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                    showMcqScoreImmediately, passMark, totalPoints, published,
                    resultRelease, timerSettings, gradingPolicy, questions
                } = req.body;

                const newExam = await db.exam.create({
                    data: {
                        title, description, category, difficulty, durationMinutes,
                        warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                        showMcqScoreImmediately, passMark, totalPoints, published,
                        resultRelease, timerSettings, gradingPolicy,
                        questions: {
                            create: questions?.map((q: any) => ({
                                type: q.type,
                                text: q.text,
                                imageUrl: q.imageUrl,
                                options: q.options,
                                correctAnswer: q.correctAnswer,
                                points: q.points,
                                category: q.category
                            })) || []
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
    }

    // === ROUTE: /api/exams/[id] ===
    if (Array.isArray(route) && route.length === 1) {
        const id = route[0];

        // GET: Fetch Details
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
                                correctAnswer: isAdmin,
                            }
                        }
                    }
                });

                if (!exam) return res.status(404).json({ error: 'Exam not found' });
                if (!isAdmin && !exam.published) return res.status(403).json({ error: 'Exam is not available' });

                return res.status(200).json(exam);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to fetch exam' });
            }
        }

        // PUT: Update
        if (req.method === 'PUT') {
            if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
            try {
                const {
                    title, description, category, difficulty, durationMinutes,
                    warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                    showMcqScoreImmediately, passMark, totalPoints, published,
                    resultRelease, timerSettings, gradingPolicy, questions
                } = req.body;

                const updatedExam = await db.$transaction(async (tx: any) => {
                    const data: any = {};
                    if (title !== undefined) data.title = title;
                    if (description !== undefined) data.description = description;
                    if (category !== undefined) data.category = category;
                    if (difficulty !== undefined) data.difficulty = difficulty;
                    if (durationMinutes !== undefined) data.durationMinutes = durationMinutes;
                    if (warningTimeThreshold !== undefined) data.warningTimeThreshold = warningTimeThreshold;
                    if (resultReleaseMode !== undefined) data.resultReleaseMode = resultReleaseMode;
                    if (scheduledReleaseDate !== undefined) data.scheduledReleaseDate = scheduledReleaseDate;
                    if (showMcqScoreImmediately !== undefined) data.showMcqScoreImmediately = showMcqScoreImmediately;
                    if (passMark !== undefined) data.passMark = passMark;
                    if (totalPoints !== undefined) data.totalPoints = totalPoints;
                    if (published !== undefined) data.published = published;
                    if (resultRelease !== undefined) data.resultRelease = resultRelease;
                    if (timerSettings !== undefined) data.timerSettings = timerSettings;
                    if (gradingPolicy !== undefined) data.gradingPolicy = gradingPolicy;

                    const exam = await tx.exam.update({ where: { id }, data });

                    if (questions && Array.isArray(questions)) {
                        await tx.question.deleteMany({ where: { examId: id } });
                        await tx.exam.update({
                            where: { id },
                            data: {
                                questions: {
                                    create: questions.map((q: any) => ({
                                        type: q.type,
                                        text: q.text,
                                        imageUrl: q.imageUrl,
                                        options: q.options || [],
                                        correctAnswer: q.correctAnswer,
                                        points: q.points || 1,
                                        category: q.category
                                    }))
                                }
                            }
                        });
                    }
                    return exam;
                });
                return res.status(200).json(updatedExam);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to update exam' });
            }
        }

        // DELETE
        if (req.method === 'DELETE') {
            if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
            try {
                await db.exam.delete({ where: { id } });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Failed to delete exam' });
            }
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
