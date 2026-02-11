
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

    const { action, id } = req.query;

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
                    currentResults[questionId] = result;

                    const newScore = Object.values(currentResults).reduce((acc: number, r: any) => acc + (r.score || 0), 0);
                    const allGraded = Object.values(currentResults).every((r: any) => r.isCorrect !== undefined);

                    await db.submission.update({
                        where: { id },
                        data: {
                            questionResults: currentResults,
                            score: newScore,
                            status: allGraded ? 'GRADED' : 'PENDING_MANUAL_REVIEW',
                            graded: allGraded
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

            if (action === 'ai-grade') {
                return res.status(501).json({ error: 'AI Grading not implemented' });
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

            // Fallthrough for generic update? No, that's PUT.
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
                                questions: {
                                    select: {
                                        id: true, text: true, type: true, options: true, points: true,
                                        correctAnswer: true // Always fetch, sanitize later
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
                        questionResults: undefined
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

                // Allow params that are not directly in schema but used for logic below (none currently, logic uses updates.answers)

                // Filter updates to include only allowable keys
                Object.keys(updates).forEach(key => {
                    if (!allowedFields.includes(key)) delete updates[key];
                });

                if (updates.answers && submission.exam) {
                    const exam = submission.exam;
                    let totalScore = 0;
                    const questionResults: Record<string, any> = {};
                    let requiresManualGrading = false;

                    for (const q of exam.questions) {
                        const userAnswer = updates.answers[q.id];
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

                    updates.score = totalScore;
                    updates.questionResults = questionResults;
                    updates.status = requiresManualGrading ? 'PENDING_MANUAL_REVIEW' : 'GRADED';
                    updates.graded = !requiresManualGrading;
                    updates.resultsReleased = exam.resultRelease === 'INSTANT';
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
                        ...exam,
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
                    ...exam, // valid: spreads all scalar fields (timerSettings, etc)
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
        // Action: Release Results (Toggle)
        if (action === 'toggle-release') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            // Expecting body: { release: boolean }
            const { release } = req.body;
            if (typeof release !== 'boolean') return res.status(400).json({ error: 'Exepcted boolean release state' });

            try {
                await db.submission.update({
                    where: { id: Array.isArray(id) ? id[0] : id },
                    data: { resultsReleased: release }
                });
                return res.status(200).json({ success: true, released: release });
            } catch (e) { return res.status(500).json({ error: 'Failed' }); }
        }

        // Action: Release All Delayed (Smart Release)
        // Releases all submissions where Exam is SCHEDULED and Date is Past
        if (action === 'release-all') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                // 1. Find all SCHEDULED exams that are due
                const dueExams = await db.exam.findMany({
                    where: {
                        resultReleaseMode: 'SCHEDULED',
                        scheduledReleaseDate: { lte: new Date() }
                    },
                    select: { id: true }
                });

                const dueExamIds = dueExams.map(e => e.id);

                if (dueExamIds.length > 0) {
                    // 2. Release all unreleased submissions for these exams
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
                    if (!sub.exam) continue; // Orphaned submission?

                    let newScore = 0;
                    const newQuestionResults: Record<string, any> = {};
                    let requiresManual = false;

                    // Re-run grading logic
                    for (const q of sub.exam.questions) {
                        const userAnswer = (sub.answers as any)[q.id];
                        const result: any = { score: 0, isCorrect: false };

                        if (q.type === 'MCQ' || q.type === 'SBA') {
                            // Loose comparison (trim and stringify)
                            if (String(userAnswer || '').trim() === String(q.correctAnswer || '').trim()) {
                                result.score = q.points;
                                result.isCorrect = true;
                                newScore += q.points;
                            }
                        } else if (q.type === 'THEORY') {
                            // Preserve existing manual score if available, otherwise 0
                            const existingResult = (sub.questionResults as any)?.[q.id];
                            if (existingResult && existingResult.score !== undefined) {
                                result.score = existingResult.score;
                                newScore += result.score;
                            } else {
                                requiresManual = true;
                            }
                        }
                        newQuestionResults[q.id] = result;
                    }

                    // Strict Update Logic
                    const newStatus = requiresManual ? 'PENDING_MANUAL_REVIEW' : 'GRADED';
                    const newGraded = !requiresManual;

                    if (
                        sub.score !== newScore ||
                        !sub.questionResults ||
                        sub.status !== newStatus ||
                        sub.graded !== newGraded
                    ) {
                        console.log(`[Regrade] Updating ${sub.id}: Score ${sub.score} -> ${newScore}`);
                        await db.submission.update({
                            where: { id: sub.id },
                            data: {
                                score: newScore,
                                questionResults: newQuestionResults,
                                status: newStatus,
                                graded: newGraded
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
                            exam: { select: { title: true } }
                        }
                    });
                    const mapped = mySubmissions.map(s => ({
                        ...s,
                        gradingStatus: s.status
                    }));
                    return res.status(200).json(mapped);
                } catch (historyError) {
                    console.error("History fetch error:", historyError);
                    // Fallback to simple fetch if relation failed
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
