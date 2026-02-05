
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/prisma';
import { verifyToken } from '../../_lib/auth';
import { GradingStatus } from '@prisma/client'; // Assuming types generated

export default async function handleAttemptStart(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { examId } = req.body;
        if (!examId) return res.status(400).json({ error: 'Missing examId' });

        // 1. Check if Exam exists and is published
        const exam = await db.exam.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        if (!exam.published && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Exam is not available' });
        }

        // 2. Check for existing UNGRADED or incomplete submission
        // We assume if it's ungraded, it's an active attempt.
        const existing = await db.submission.findFirst({
            where: {
                examId: examId,
                studentId: user.userId,
                gradingStatus: 'UNGRADED'
                // We might also check if 'submittedAt' is in the future? No, submittedAt is usually set when finalized.
                // If we use 'resultReleased' or 'graded' to mark completion.
                // Let's rely on 'gradingStatus' being UNGRADED as "In Progress" or "Submitted but not graded".
                // Currently, explicit submit changes status?
                // If user just closed browser, status is UNGRADED.
                // We should check if they explicitly "Finished".
                // The 'Submission' model might need an 'isFinal' flag or we use 'score' or 'graded'.
                // For now, if they have an active submission, we return it to RESUME.
            }
        });

        if (existing) {
            // Resume
            return res.status(200).json({
                submissionId: existing.id,
                answersDraft: existing.answersDraft || existing.answers || {}, // Resume from draft or final answers if present
                timeStarted: existing.timeStarted,
                resumed: true
            });
        }

        // 3. Create new Submission
        const newSubmission = await db.submission.create({
            data: {
                examId,
                studentId: user.userId,
                examVersion: exam.version,
                answers: {},
                answersDraft: {},
                questionResults: {},
                score: 0,
                rawScore: 0,
                negativeDeduction: 0,
                latePenaltyDeduction: 0,
                graded: false,
                gradingStatus: 'UNGRADED',
                submittedAt: 0, // Not submitted yet. Or use now? 
                // If we use 0, lists might sort weirdly.
                // Let's use Date.now() as creation time, but 'resultsReleased' is false.
                // Ideally we have 'startedAt'.
                timeStarted: Date.now(),
                resultsReleased: false
            }
        });

        return res.status(200).json({
            submissionId: newSubmission.id,
            answersDraft: {},
            timeStarted: newSubmission.timeStarted,
            resumed: false
        });

    } catch (e) {
        console.error('Attempt start error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
