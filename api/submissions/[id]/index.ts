
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db.js';
import { authLib } from '../../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token || req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let user;
    try {
        user = authLib.verifyToken(token);
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // === ACTIONS (POST) ===
    if (req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

        // Grade
        if (action === 'grade') {
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
            } catch (e) {
                return res.status(500).json({ error: 'Grading failed' });
            }
        }

        // Release
        if (action === 'release') {
            try {
                await db.submission.update({
                    where: { id },
                    data: { resultsReleased: true }
                });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ error: 'Failed' });
            }
        }

        // AI Grade
        if (action === 'ai-grade') {
            return res.status(501).json({ error: 'AI Grading not implemented' });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    // === STANDARD OPERATIONS ===

    // GET: Detail
    if (req.method === 'GET') {
        try {
            const submission = await db.submission.findUnique({
                where: { id },
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

            const mapped = { ...submission, gradingStatus: submission.status };

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

            // Permission Check
            if (submission.userId !== user.userId && !isAdmin) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const updates = req.body;
            delete updates.id; // Ensure ID is not updated
            delete updates.studentId; // Remove non-schema field
            delete updates.submittedAt; // Remove to prevent type mismatch (string vs Date) and preserve start time

            // Security: Prevent candidates from modifying critical fields directly
            if (!isAdmin) {
                delete updates.userId;
                delete updates.examId;
                delete updates.score;
                delete updates.graded;
                delete updates.status;
                delete updates.questionResults;
            }

            // Grading Logic (if answers are provided and we are effectively submitting or updating)
            // If the client sends 'answers', we should re-grade.
            if (updates.answers) {
                const exam = submission.exam;
                if (exam) {
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
            }

            // Do NOT update submittedAt. It represents the Start Time of the attempt.
            // We can calculate 'finishedAt' implicitly or use timeSpentMs.
            // if (updates.submittedAt) { updates.submittedAt = new Date(updates.submittedAt); }

            const updated = await db.submission.update({ where: { id }, data: updates });
            return res.status(200).json({ ...updated, gradingStatus: updated.status });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to update' });
        }
    }

    // DELETE: Single
    if (req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        await db.submission.delete({ where: { id } });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
