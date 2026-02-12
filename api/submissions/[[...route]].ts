
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { calculateGrade } from '../_lib/grading.js';

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

    let { action, id } = req.query;
    const { route } = req.query;

    // Handle Vercel Dynamic Route: /api/submissions/123
    if (!id && Array.isArray(route) && route.length > 0) {
        id = route[0];
    }

    // === SINGLE ID OPERATIONS (Logic merged from [id].ts) ===
    if (id && typeof id === 'string') {
        // POST: Actions on specific submission
        if (req.method === 'POST') {
            if (action === 'grade') {
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
                try {
                    const { questionId, result } = req.body;
                    const submission = await db.submission.findUnique({ where: { id } });
                    if (!submission) return res.status(404).json({ error: 'Submission not found' });

                    const currentResults: any = submission.questionResults || {};
                    // Ensure result has score and isCorrect
                    currentResults[questionId] = {
                        score: Number(result.score) || 0,
                        isCorrect: result.isCorrect ?? (Number(result.score) > 0)
                    };

                    const fullSubmission = await db.submission.findUnique({
                        where: { id },
                        include: { exam: { include: { questions: true } } }
                    });

                    if (!fullSubmission || !fullSubmission.exam) return res.status(404).json({ error: 'Data sync error' });

                    const gradeResult = calculateGrade(
                        fullSubmission.exam,
                        fullSubmission.answers as Record<string, any>,
                        currentResults
                    );

                    await db.submission.update({
                        where: { id },
                        data: {
                            questionResults: gradeResult.questionResults,
                            score: gradeResult.score,
                            status: gradeResult.status,
                            graded: gradeResult.graded
                        }
                    });
                    return res.status(200).json({ success: true });
                } catch (e) { return res.status(500).json({ error: 'Grading failed' }); }
            }

            if (action === 'release') {
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
                try {
                    await db.submission.update({ where: { id }, data: { resultsReleased: true } });
                    return res.status(200).json({ success: true });
                } catch (e) { return res.status(500).json({ error: 'Failed' }); }
            }



            if (action === 'toggle-release') {
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
                const { release } = req.body;
                if (typeof release !== 'boolean') return res.status(400).json({ error: 'Exepcted boolean release state' });

                await db.submission.update({
                    where: { id },
                    data: { resultsReleased: release }
                });
                return res.status(200).json({ success: true, released: release });
            }

            if (action === 'regrade') {
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
                try {
                    const submission = await db.submission.findUnique({
                        where: { id },
                        include: { exam: { include: { questions: true } } }
                    });

                    if (!submission || !submission.exam) return res.status(404).json({ error: 'Not found' });

                    const gradeResult = calculateGrade(
                        submission.exam,
                        submission.answers as Record<string, any>,
                        submission.questionResults as Record<string, any>
                    );

                    await db.submission.update({
                        where: { id },
                        data: {
                            score: gradeResult.score,
                            questionResults: gradeResult.questionResults,
                            status: gradeResult.status,
                            graded: gradeResult.graded
                        }
                    });

                    return res.status(200).json({ success: true, result: gradeResult });
                } catch (e) { return res.status(500).json({ error: 'Regrade failed' }); }
            }

            if (action === 'review') {
                if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
                try {
                    await db.submission.update({
                        where: { id },
                        data: {
                            status: 'REVIEWED',
                            reviewedAt: new Date(),
                            reviewedBy: user.userId
                        }
                    });
                    return res.status(200).json({ success: true });
                } catch (e) { return res.status(500).json({ error: 'Failed' }); }
            }

            return res.status(400).json({ error: 'Invalid action' });
        }

        // GET: Detail
        if (req.method === 'GET') {
            try {
                const submission = await db.submission.findUnique({
                    where: { id },
                    include: {
                        exam: {
                            select: {
                                title: true,
                                totalPoints: true,
                                passMark: true,
                                questions: {
                                    select: {
                                        id: true, text: true, type: true, options: true, points: true,
                                        correctAnswer: true, // Always fetch, sanitize later
                                        imageUrl: true
                                    }
                                }
                            }
                        },
                        user: { select: { name: true, email: true } }
                    }
                });

                if (!submission) return res.status(404).json({ error: 'Submission not found' });
                if (submission.userId !== user.userId && !isAdmin) return res.status(403).json({ error: 'Access denied' });

                const mapped = { ...submission, gradingStatus: submission.status };

                // Sanitize if NOT Admin AND NOT Released
                if (!isAdmin && !submission.resultsReleased) {
                    const sanitizedSubmission = {
                        ...mapped,
                        exam: {
                            ...mapped.exam,
                            questions: mapped.exam.questions.map(q => ({ ...q, correctAnswer: undefined }))
                        },
                        questionResults: undefined // Hide results until released
                    };
                    return res.status(200).json(sanitizedSubmission);
                }

                // If Released, Candidate can see correct answers.
                return res.status(200).json(mapped);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to fetch submission' });
            }
        }

        // PUT: Update
        if (req.method === 'PUT') {
            try {
                const submission = await db.submission.findUnique({ where: { id }, include: { exam: { include: { questions: true } } } });
                if (!submission) return res.status(404).json({ error: 'Submission not found' });

                if (submission.userId !== user.userId && !isAdmin) return res.status(403).json({ error: 'Access denied' });

                const updates = req.body;

                // Whitelist allowed fields to prevent "Unknown argument" errors
                const allowedFields = [
                    'answers', 'answersDraft', 'questionResults',
                    'score', 'status', 'graded', 'resultsReleased'
                ];

                // Filter updates to include only allowable keys
                Object.keys(updates).forEach(key => {
                    if (!allowedFields.includes(key)) delete updates[key];
                });

                if (updates.answers && submission.exam) {
                    const gradeResult = calculateGrade(
                        submission.exam,
                        updates.answers,
                        (updates.questionResults || submission.questionResults) as Record<string, any>
                    );

                    updates.score = gradeResult.score;
                    updates.questionResults = gradeResult.questionResults;
                    updates.status = gradeResult.status;
                    updates.graded = gradeResult.graded;
                    updates.resultsReleased = submission.exam.resultRelease === 'INSTANT';
                }

                const updated = await db.submission.update({ where: { id }, data: updates });
                return res.status(200).json({ ...updated, gradingStatus: updated.status });
            } catch (e) {
                return res.status(500).json({ error: 'Failed to update' });
            }
        }

        // DELETE: Single
        if (req.method === 'DELETE') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            await db.submission.delete({ where: { id } });
            return res.status(200).json({ success: true });
        }
    }

    // === ACTIONS (POST) - Generic / Bulk ===
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

            // Look for existing active submission (most recent)
            const existing = await db.submission.findFirst({
                where: { userId: user.userId, examId: examId },
                orderBy: { submittedAt: 'desc' }
            });

            // Resume if existing and NOT graded/released? 
            if (existing && existing.status === 'UNGRADED' && !existing.resultsReleased) {
                const sanitizedQuestions = exam.questions.map(q => ({
                    id: q.id,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    points: q.points,
                    imageUrl: q.imageUrl
                }));

                return res.status(200).json({
                    exam: {
                        ...exam,
                        questions: sanitizedQuestions
                    },
                    startTime: existing.submittedAt.getTime(),
                    submissionId: existing.id,
                    answersDraft: existing.answersDraft || {},
                    resumed: true
                });
            }

            // Create New Submission
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
                points: q.points,
                imageUrl: q.imageUrl
            }));

            // Exclude source link from active attempt
            const { resourceLink, ...safeExamLabels } = exam as any;

            return res.status(200).json({
                exam: {
                    ...safeExamLabels,
                    resourceLink: undefined, // Explicitly undefined
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

        // Release All for specific Exam
        if (action === 'release-exam') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            const { examId } = req.body;
            if (!examId) return res.status(400).json({ error: 'Missing examId' });

            try {
                const count = await db.submission.updateMany({
                    where: { examId, resultsReleased: false }, // Only unreleased
                    data: { resultsReleased: true }
                });
                return res.status(200).json({ success: true, count: count.count });
            } catch (e) { return res.status(500).json({ error: 'Failed to release exam results' }); }
        }

        // Release All Scheduled (Global Check)
        if (action === 'release-all-scheduled') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                const dueExams = await db.exam.findMany({
                    where: {
                        resultReleaseMode: 'SCHEDULED',
                        scheduledReleaseDate: { lte: new Date() }
                    },
                    select: { id: true }
                });

                const dueExamIds = dueExams.map(e => e.id);

                if (dueExamIds.length > 0) {
                    await db.submission.updateMany({
                        where: {
                            examId: { in: dueExamIds },
                            resultsReleased: false
                        },
                        data: { resultsReleased: true }
                    });
                }

                return res.status(200).json({ success: true, count: dueExamIds.length });
            } catch (e) {
                return res.status(500).json({ error: 'Failed' });
            }
        }

        // Action: Re-grade All (Retroactive Fix)
        if (action === 'regrade-all') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                // Fetch all submissions with their exams and questions
                const submissions = await db.submission.findMany({
                    include: { exam: { include: { questions: true } } }
                });

                console.log(`[Regrade] Found ${submissions.length} submissions.`);

                let updateCount = 0;

                for (const sub of submissions) {
                    if (!sub.exam) continue;

                    const gradeResult = calculateGrade(
                        sub.exam,
                        sub.answers as Record<string, any>,
                        sub.questionResults as Record<string, any>
                    );

                    // Strict Update Logic
                    if (
                        sub.score !== gradeResult.score ||
                        JSON.stringify(sub.questionResults) !== JSON.stringify(gradeResult.questionResults) ||
                        sub.status !== gradeResult.status ||
                        sub.graded !== gradeResult.graded
                    ) {
                        console.log(`[Regrade] Updating ${sub.id}: Score ${sub.score} -> ${gradeResult.score}`);
                        await db.submission.update({
                            where: { id: sub.id },
                            data: {
                                score: gradeResult.score,
                                questionResults: gradeResult.questionResults,
                                status: gradeResult.status,
                                graded: gradeResult.graded
                            }
                        });
                        updateCount++;
                    }
                }

                return res.status(200).json({ success: true, count: updateCount });
            } catch (e) {
                return res.status(500).json({ error: 'Failed to regrade' });
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
                try {
                    const mySubmissions = await db.submission.findMany({
                        where: { userId: user.userId },
                        orderBy: { submittedAt: 'desc' },
                        include: {
                            exam: { select: { title: true, totalPoints: true } }
                        }
                    });
                    const mapped = mySubmissions.map(s => ({
                        ...s,
                        gradingStatus: s.status
                    }));
                    return res.status(200).json(mapped);
                } catch (historyError) {
                    console.error("History fetch error:", historyError);
                    const raw = await db.submission.findMany({
                        where: { userId: user.userId },
                        orderBy: { submittedAt: 'desc' }
                    });
                    return res.status(200).json(raw);
                }
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
                            exam: { select: { title: true, totalPoints: true } }
                        },
                        orderBy: { submittedAt: 'desc' }
                    }),
                    db.submission.count()
                ]);
            } catch (err: any) {
                console.error("Submission Fetch Error (Include failed?):", err);
                const rawSubs = await db.submission.findMany({
                    skip,
                    take: limit,
                    orderBy: { submittedAt: 'desc' }
                });
                total = await db.submission.count();
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

            const gradeResult = calculateGrade(exam, answers);

            const submission = await db.submission.create({
                data: {
                    examId,
                    userId: user.userId,
                    answers,
                    questionResults: gradeResult.questionResults,
                    score: gradeResult.score,
                    timeSpentMs: Number(timeSpentMs) || 0,
                    status: gradeResult.status,
                    graded: gradeResult.graded,
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

    return res.status(405).json({ error: 'Method not allowed' });
}
