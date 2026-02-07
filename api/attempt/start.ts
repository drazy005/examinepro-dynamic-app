import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';

export default async function handleAttemptStart(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        const user = token ? authLib.verifyToken(token) : null;

        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { examId } = req.body;
        if (!examId) return res.status(400).json({ error: 'Missing examId' });

        // 1. Check if Exam exists and is published
        const exam = await db.exam.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        if (!exam.published && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Exam is not available' });
        }

        // 2. Check for existing UNGRADED attempt
        const existing = await db.submission.findFirst({
            where: {
                examId: examId,
                userId: user.userId,
                status: 'UNGRADED'
            }
        });

        if (existing) {
            // Resume
            return res.status(200).json({
                submissionId: existing.id,
                answersDraft: existing.answersDraft || existing.answers || {},
                timeStarted: existing.submittedAt.getTime(),
                resumed: true
            });
        }

        // 3. Create new Submission
        const newSubmission = await db.submission.create({
            data: {
                examId,
                userId: user.userId,
                answers: {},
                answersDraft: {},
                questionResults: {},
                score: 0,
                graded: false,
                status: 'UNGRADED',
                submittedAt: new Date(),
                resultsReleased: false,
                timeSpentMs: 0
            }
        });

        return res.status(200).json({
            submissionId: newSubmission.id,
            answersDraft: {},
            timeStarted: newSubmission.submittedAt.getTime(),
            resumed: false
        });

    } catch (e) {
        console.error('Attempt start error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
