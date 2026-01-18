import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../lib/db';
import { authLib } from '../../lib/auth';
import { parse } from 'cookie';
import { QuestionType, GradingStatus } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cookies = parse(req.headers.cookie || '');
    const user = authLib.verifyToken(cookies.auth_token || '');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { examId, answers, timeSpentMs } = req.body; // answers: Record<string, string>

        // 1. Fetch Exam and Correct Answers (SERVER SIDE ONLY)
        const exam = await db.exam.findUnique({
            where: { id: examId },
            include: { questions: true }
        });

        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        // 2. Deterministic Grading Logic
        let totalScore = 0;
        const questionResults: Record<string, any> = {};
        let requiresManualGrading = false;

        for (const q of exam.questions) {
            const userAnswer = answers[q.id];
            const result: any = { score: 0, isCorrect: false };

            if (q.type === QuestionType.MCQ || q.type === QuestionType.SBA) {
                // Strict string comparison for objective questions
                if (userAnswer === q.correctAnswer) {
                    result.score = q.points;
                    result.isCorrect = true;
                    totalScore += q.points;
                }
            } else if (q.type === QuestionType.THEORY) {
                // Theory questions default to 0 and flagged for manual review
                result.score = 0;
                requiresManualGrading = true;
            }

            questionResults[q.id] = result;
        }

        // 3. Save Submission
        const submission = await db.submission.create({
            data: {
                examId,
                userId: user.userId,
                answers,
                questionResults,
                score: totalScore,
                timeSpentMs,
                status: requiresManualGrading ? GradingStatus.PENDING_MANUAL_REVIEW : GradingStatus.GRADED,
                graded: !requiresManualGrading, // If all MCQ, it's graded.
                resultsReleased: exam.resultRelease === 'INSTANT',
            }
        });

        return res.status(200).json(submission);

    } catch (e) {
        console.error('Submission error:', e);
        return res.status(500).json({ error: 'Failed to submit exam' });
    }
}
