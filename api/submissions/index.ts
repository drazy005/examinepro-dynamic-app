
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

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    const { action } = req.query;

    // === ACTIONS (POST) ===
    if (req.method === 'POST') {
        // Start Attempt
        if (action === 'start') {
            const { examId } = req.body;
            if (!examId) return res.status(400).json({ error: 'Missing Exam ID' });

            const exam = await db.exam.findUnique({
                where: { id: examId },
                include: { questions: true }
            });

            if (!exam) return res.status(404).json({ error: 'Exam not found' });
            if (!exam.published && !isAdmin) return res.status(403).json({ error: 'Exam not published' });

            // Check for existing attempt (resume if not released?)
            // For now, if there is a submission that is not released, resume it?
            // Schema has 'resultsReleased'. 
            // Also we might want to check if time limit expired. 
            // For MVP, look for the most recent submission.
            const existing = await db.submission.findFirst({
                where: { userId: user.userId, examId: examId },
                orderBy: { submittedAt: 'desc' }
            });

            // Resume if existing and NOT graded/released? 
            // OR if time is not up?
            // For simplicity: if it's UNGRADED, resume it.
            if (existing && existing.status === 'UNGRADED' && !existing.resultsReleased) {
                const sanitizedQuestions = exam.questions.map(q => ({
                    id: q.id,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    points: q.points
                }));

                return res.status(200).json({
                    exam: {
                        id: exam.id,
                        title: exam.title,
                        durationMinutes: exam.durationMinutes,
                        questions: sanitizedQuestions
                    },
                    startTime: existing.submittedAt.getTime(), // Or created time if we had it? submittedAt defaults to now() on create
                    submissionId: existing.id,
                    answersDraft: existing.answersDraft || {},
                    resumed: true
                });
            }

            // Create New Submission
            // We set submittedAt to NOW, which marks the start time.
            const newSubmission = await db.submission.create({
                data: {
                    examId,
                    userId: user.userId,
                    answers: {}, // Empty initially
                    questionResults: {},
                    status: 'UNGRADED',
                    submittedAt: new Date(), // Start time
                    graded: false,
                    resultsReleased: false
                }
            });

            const sanitizedQuestions = exam.questions.map(q => ({
                id: q.id,
                text: q.text,
                type: q.type,
                options: q.options,
                points: q.points
            }));

            return res.status(200).json({
                exam: {
                    id: exam.id,
                    title: exam.title,
                    durationMinutes: exam.durationMinutes,
                    questions: sanitizedQuestions
                },
                startTime: newSubmission.submittedAt.getTime(),
                submissionId: newSubmission.id,
                answersDraft: {},
                resumed: false
            });
        }

        // Draft Save
        if (action === 'draft') {
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

        // Release All
        if (action === 'release-all') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                await db.submission.updateMany({
                    where: { resultsReleased: false },
                    data: { resultsReleased: true }
                });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Failed' });
            }
        }
    }

    // === STANDARD OPERATIONS ===

    // GET: List
    if (req.method === 'GET') {
        const { mode } = req.query;
        try {
            if (mode === 'history') {
                // Candidate View
                const mySubmissions = await db.submission.findMany({
                    where: { userId: user.userId },
                    orderBy: { submittedAt: 'desc' },
                    include: {
                        exam: { select: { title: true } }
                    }
                });
                const mapped = mySubmissions.map(s => ({
                    ...s,
                    gradingStatus: s.status
                }));
                return res.status(200).json(mapped);
            }

            // Admin View
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 50;
            const skip = (page - 1) * limit;

            console.log(`[Submissions] Fetching page ${page}, limit ${limit}, skip ${skip}, isAdmin ${isAdmin}`);
            let submissions, total;
            try {
                // Verify count first
                total = await db.submission.count();
                console.log(`[Submissions] Total count in DB: ${total}`);

                if (total === 0) {
                    return res.status(200).json({
                        data: [],
                        pagination: { total: 0, page, limit, totalPages: 0 }
                    });
                }

                [submissions, total] = await Promise.all([
                    db.submission.findMany({
                        skip,
                        take: limit,
                        include: {
                            user: { select: { name: true, email: true } },
                            exam: { select: { title: true } }
                        },
                        orderBy: { submittedAt: 'desc' }
                    }),
                    db.submission.count()
                ]);
            } catch (err: any) {
                // Fallback if include fails due to broken relations: fetch raw and invalid relations are ignored (nullable in map)
                console.error("Submission Fetch Error (Include failed?):", err);
                const rawSubs = await db.submission.findMany({
                    skip,
                    take: limit,
                    orderBy: { submittedAt: 'desc' }
                });
                total = await db.submission.count();

                // Manually populate headers if needed, or just return raw (names will be missing)
                // For valid display, we try to fetch names separately? 
                // Too complex for now. Just return raw and let frontend say "Unknown".
                submissions = rawSubs.map(s => ({ ...s, user: null, exam: null }));
            }

            const mappedSubmissions = submissions.map(s => ({
                ...s,
                gradingStatus: s.status
            }));

            return res.status(200).json({
                data: mappedSubmissions,
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

    // POST: Create Submission (Generic Save)
    if (req.method === 'POST' && !action) {
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
                    timeSpentMs: Number(timeSpentMs) || 0,
                    status: requiresManualGrading ? 'PENDING_MANUAL_REVIEW' : 'GRADED',
                    graded: !requiresManualGrading,
                    resultsReleased: exam.resultRelease === 'INSTANT',
                    submittedAt: new Date(),
                }
            });

            return res.status(200).json({ ...submission, gradingStatus: submission.status });
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
