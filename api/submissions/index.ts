import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const user = authLib.verifyToken(cookies.auth_token || '');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // GET: List Submissions
    if (req.method === 'GET') {
        const { mode } = req.query;

        try {
            if (mode === 'history') {
                // Candidate View: Own submissions
                const mySubmissions = await db.submission.findMany({
                    where: { userId: user.userId },
                    orderBy: { submittedAt: 'desc' }
                });
                return res.status(200).json(mySubmissions);
            }

            // Admin View: All submissions
            const role = user.role as string;
            if (role !== 'ADMIN' && role !== 'TUTOR' && role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Access denied' });
            }

            const submissions = await db.submission.findMany({
                include: { user: { select: { name: true, email: true } } }, // Join user info
                orderBy: { submittedAt: 'desc' }
            });
            return res.status(200).json(submissions);

        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch submissions' });
        }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

            if (q.type === 'MCQ' || q.type === 'SBA') {
                // Strict string comparison for objective questions
                if (userAnswer === q.correctAnswer) {
                    result.score = q.points;
                    result.isCorrect = true;
                    totalScore += q.points;
                }
            } else if (q.type === 'THEORY') {
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
                status: requiresManualGrading ? 'PENDING_MANUAL_REVIEW' : 'GRADED',
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
