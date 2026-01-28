import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const isAdmin = ['ADMIN', 'TUTOR', 'SUPERADMIN'].includes(user.role as string);

    // GET: Fetch Submission Details
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
                                    id: true,
                                    text: true,
                                    type: true,
                                    options: true,
                                    points: true,
                                    correctAnswer: true // We might need this to show corrections?
                                }
                            }
                        }
                    },
                    user: { select: { name: true, email: true } }
                }
            });

            if (!submission) return res.status(404).json({ error: 'Submission not found' });

            // specific check: User can only see their own, unless Admin
            if (submission.userId !== user.userId && !isAdmin) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Logic for hiding answers if results NOT released
            if (!isAdmin && !submission.resultsReleased) {
                // Strip sensitive data
                const sanitizedSubmission = {
                    ...submission,
                    exam: {
                        ...submission.exam,
                        questions: submission.exam.questions.map(q => ({
                            ...q,
                            correctAnswer: undefined // Hide correct answer
                        }))
                    },
                    questionResults: undefined // Hide detailed breakdown if needed, or simple show placeholders
                };
                return res.status(200).json(sanitizedSubmission);
            }

            return res.status(200).json(submission);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to fetch submission' });
        }
    }

    // PUT: Update Submission (Manual Grading / Results Release)
    if (req.method === 'PUT') {
        // Only Admin/Tutor can update submissions directly (e.g. grading)
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

        try {
            const updates = req.body;
            delete updates.id; // Prevent ID change
            delete updates.userId; // Prevent User change
            delete updates.examId; // Prevent Exam change

            const updated = await db.submission.update({
                where: { id },
                data: {
                    ...updates,
                    // Ensure we can update questionResults, score, gradingStatus, resultsReleased
                }
            });
            return res.status(200).json(updated);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to update submission' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
