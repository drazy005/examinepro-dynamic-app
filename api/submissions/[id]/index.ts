
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
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            const updates = req.body;
            delete updates.id;
            delete updates.userId;
            delete updates.examId;
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

    return res.status(405).json({ error: 'Method not allowed' });
}
