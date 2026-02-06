import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';
import { authLib } from '../_lib/auth';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { route } = req.query;
    // route is string[] | string | undefined

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token || req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // === 1. ROOT ROUTES: /api/submissions ===
    if (!route || route.length === 0) {

        // GET: List Submissions
        if (req.method === 'GET') {
            const { mode } = req.query;
            try {
                if (mode === 'history') {
                    // Candidate View
                    const mySubmissions = await db.submission.findMany({
                        where: { userId: user.userId },
                        orderBy: { submittedAt: 'desc' }
                    });
                    return res.status(200).json(mySubmissions);
                }

                // Admin View
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

                // Check for single IDs bulk fetch? Not typical in this app's pattern, 
                // but checking for other query params...

                const page = Number(req.query.page) || 1;
                const limit = Number(req.query.limit) || 50;
                const skip = (page - 1) * limit;

                const [submissions, total] = await Promise.all([
                    db.submission.findMany({
                        skip,
                        take: limit,
                        include: { user: { select: { name: true, email: true } } },
                        orderBy: { submittedAt: 'desc' }
                    }),
                    db.submission.count()
                ]);

                return res.status(200).json({
                    data: submissions,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                });

            } catch (e) {
                return res.status(500).json({ error: 'Failed to fetch submissions' });
            }
        }

        // POST: Create Submission
        if (req.method === 'POST') {
            try {
                const { examId, answers, timeSpentMs } = req.body;

                const exam = await db.exam.findUnique({
                    where: { id: examId },
                    include: { questions: true }
                });

                if (!exam) return res.status(404).json({ error: 'Exam not found' });

                let totalScore = 0;
                const questionResults: Record<string, any> = {};
                let requiresManualGrading = false;

                for (const q of exam.questions) {
                    const userAnswer = answers[q.id];
                    const result: any = { score: 0, isCorrect: false };

                    if (q.type === 'MCQ' || q.type === 'SBA') {
                        if (userAnswer === q.correctAnswer) {
                            result.score = q.points;
                            result.isCorrect = true;
                            totalScore += q.points;
                        }
                    } else if (q.type === 'THEORY') {
                        result.score = 0;
                        requiresManualGrading = true;
                    }
                    questionResults[q.id] = result;
                }

                const submission = await db.submission.create({
                    data: {
                        examId,
                        userId: user.userId,
                        answers,
                        questionResults,
                        score: totalScore,
                        timeSpentMs,
                        status: requiresManualGrading ? 'PENDING_MANUAL_REVIEW' : 'GRADED',
                        graded: !requiresManualGrading,
                        resultsReleased: exam.resultRelease === 'INSTANT',
                        submittedAt: new Date(),
                    }
                });

                return res.status(200).json(submission);
            } catch (e) {
                console.error('Submission error:', e);
                return res.status(500).json({ error: 'Failed to submit exam' });
            }
        }

        // DELETE: Bulk Delete
        if (req.method === 'DELETE') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            const { ids } = req.query; // ?ids=1,2,3
            if (ids && typeof ids === 'string') {
                const idArray = ids.split(',');
                await db.submission.deleteMany({ where: { id: { in: idArray } } });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ error: 'Missing ids' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actionOrId = route[0]; // 'draft', 'release-all', or ID

    // === 2. STATIC ROUTES ===

    // POST /api/submissions/draft
    if (actionOrId === 'draft') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        try {
            const { submissionId, answers } = req.body;
            if (!submissionId || !answers) return res.status(400).json({ error: 'Missing data' });

            const submission = await db.submission.findUnique({ where: { id: submissionId } });
            if (!submission) return res.status(404).json({ error: 'Submission not found' });
            if (submission.userId !== user.userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

            await db.submission.update({
                where: { id: submissionId },
                data: { answersDraft: answers }
            });
            return res.status(200).json({ success: true, savedAt: Date.now() });
        } catch (e) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // POST /api/submissions/release-all
    if (actionOrId === 'release-all') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            // Release all where resultRelease is DELAYED? Or simply all unreleased?
            // Usually this implies 'scheduled' exams that reached their time.
            // For now, simpler implementation:
            await db.submission.updateMany({
                where: { resultsReleased: false }, // Dangerous? Assuming Intent.
                data: { resultsReleased: true }
            });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed' });
        }
    }

    // === 3. ID-BASED ROUTES ===
    const submissionId = actionOrId;
    const subRoute = route[1]; // grade, release, ai-grade

    // /api/submissions/[id]
    if (!subRoute) {
        // GET: Detail
        if (req.method === 'GET') {
            try {
                const submission = await db.submission.findUnique({
                    where: { id: submissionId },
                    include: {
                        exam: {
                            select: {
                                title: true, questions: {
                                    select: { id: true, text: true, type: true, options: true, points: true, correctAnswer: isAdmin }
                                }
                            }
                        },
                        user: { select: { name: true, email: true } }
                    }
                });

                if (!submission) return res.status(404).json({ error: 'Submission not found' });
                if (submission.userId !== user.userId && !isAdmin) return res.status(403).json({ error: 'Access denied' });

                if (!isAdmin && !submission.resultsReleased) {
                    const sanitizedSubmission = {
                        ...submission,
                        exam: {
                            ...submission.exam,
                            questions: submission.exam.questions.map(q => ({ ...q, correctAnswer: undefined }))
                        },
                        questionResults: undefined
                    };
                    return res.status(200).json(sanitizedSubmission);
                }
                return res.status(200).json(submission);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to fetch submission' });
            }
        }

        // PUT: Update
        if (req.method === 'PUT') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                const updates = req.body;
                delete updates.id;
                delete updates.userId;
                delete updates.examId;
                const updated = await db.submission.update({ where: { id: submissionId }, data: updates });
                return res.status(200).json(updated);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to update' });
            }
        }

        // DELETE: Single
        if (req.method === 'DELETE') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            await db.submission.delete({ where: { id: submissionId } });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    }

    // /api/submissions/[id]/grade
    if (subRoute === 'grade') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            const { questionId, result } = req.body; // result: { score, feedback, isCorrect }
            const submission = await db.submission.findUnique({ where: { id: submissionId } });
            if (!submission) return res.status(404).json({ error: 'Submission not found' });

            const currentResults: any = submission.questionResults || {};
            currentResults[questionId] = result;

            // Re-calc score
            const newScore = Object.values(currentResults).reduce((acc: number, r: any) => acc + (r.score || 0), 0);
            const allGraded = Object.values(currentResults).every((r: any) => r.isCorrect !== undefined); // Simple check

            await db.submission.update({
                where: { id: submissionId },
                data: {
                    questionResults: currentResults,
                    score: newScore,
                    status: allGraded ? 'GRADED' : 'PENDING_MANUAL_REVIEW',
                    graded: allGraded
                }
            });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Grading failed' });
        }
    }

    // /api/submissions/[id]/release
    if (subRoute === 'release') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            await db.submission.update({
                where: { id: submissionId },
                data: { resultsReleased: true }
            });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed' });
        }
    }

    // /api/submissions/[id]/ai-grade
    if (subRoute === 'ai-grade') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        // Placeholder for AI grading logic
        return res.status(501).json({ error: 'AI Grading not implemented in this refactor yet' });
    }

    return res.status(404).json({ error: 'Not found' });
}
