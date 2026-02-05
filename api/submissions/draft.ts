
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/prisma';
import { verifyToken } from '../../_lib/auth';

export default async function handleDraft(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { submissionId, answers } = req.body;

        if (!submissionId || !answers) {
            return res.status(400).json({ error: 'Missing submissionId or answers' });
        }

        // Verify ownership
        const submission = await db.submission.findUnique({ where: { id: submissionId } });
        if (!submission) return res.status(404).json({ error: 'Submission not found' });

        if (submission.studentId !== user.userId && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (submission.graded || submission.gradingStatus !== 'UNGRADED') {
            // Exam already submitted? Maybe allow draft save if strict mode is off, but generally no.
            // Actually if it's graded, we shouldn't touch it.
            return res.status(409).json({ error: 'Submission is already finalized' });
        }

        await db.submission.update({
            where: { id: submissionId },
            data: {
                answersDraft: answers, // Save to draft column
                // We do NOT update 'answers' or 'submittedAt' here.
                // 'answers' column is for the FINAL submission.
            }
        });

        return res.status(200).json({ success: true, savedAt: Date.now() });

    } catch (e) {
        console.error('Draft save error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
