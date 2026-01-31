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

    const role = user.role as string;
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

    // GET: Fetch Exam Details
    if (req.method === 'GET') {
        try {
            const exam = await db.exam.findUnique({
                where: { id },
                include: {
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            type: true,
                            options: true,
                            points: true,
                            // precise behavior: don't reveal correctAnswer to candidates here unless verified flow
                            // For now, only Admins get correct answers via this specific endpoint? 
                            // Or standard behavior: do NOT send correctAnswer to client.
                        }
                    }
                }
            });

            if (!exam) return res.status(404).json({ error: 'Exam not found' });

            // If Candidate, ensure it is published
            if (!isAdmin && !exam.published) {
                return res.status(403).json({ error: 'Exam is not available' });
            }

            return res.status(200).json(exam);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch exam' });
        }
    }

    // PUT: Update Exam
    if (req.method === 'PUT') {
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

        try {
            const {
                title, description, category, difficulty, durationMinutes,
                warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                showMcqScoreImmediately, passMark, totalPoints, published,
                resultRelease, timerSettings, gradingPolicy, questions
            } = req.body;

            // Update exam and replace questions in a transaction
            const updatedExam = await db.$transaction(async (tx: any) => {
                // 1. Update basic exam details
                const exam = await tx.exam.update({
                    where: { id },
                    data: {
                        title, description, category, difficulty, durationMinutes,
                        warningTimeThreshold, resultReleaseMode, scheduledReleaseDate,
                        showMcqScoreImmediately, passMark, totalPoints, published,
                        resultRelease, timerSettings, gradingPolicy
                    }
                });

                // 2. If questions are provided, replace them
                if (questions && Array.isArray(questions)) {
                    // Delete existing questions
                    await tx.question.deleteMany({
                        where: { examId: id }
                    });

                    // Create new questions
                    // Note: We use createMany if possible, but for relation safety (and if we need specific nested logic later),
                    // individual creates inside the transaction are fine. ensure `createMany` is supported by your DB/Prisma version for relations or use map.
                    // For nested relations, we can use update with `questions: { deleteMany: {}, create: [...] }` but strict control is better here.

                    // Better approach: use the update's nested write (atomic)
                    await tx.exam.update({
                        where: { id },
                        data: {
                            questions: {
                                create: questions.map((q: any) => ({
                                    type: q.type,
                                    text: q.text,
                                    imageUrl: q.imageUrl,
                                    options: q.options || [],
                                    correctAnswer: q.correctAnswer,
                                    points: q.points || 1,
                                    category: q.category
                                }))
                            }
                        }
                    });
                }

                return exam;
            });

            return res.status(200).json(updatedExam);
        } catch (e) {
            console.error('Update Exam Error:', e);
            return res.status(500).json({ error: 'Failed to update exam' });
        }
    }

    // DELETE: Delete Exam
    if (req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

        try {
            await db.exam.delete({ where: { id } });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed to delete exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
