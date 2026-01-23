import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    // GET: List Exams
    if (req.method === 'GET') {
        const { mode } = req.query;

        try {
            if (mode === 'available') {
                // Candidate View: Only published, active exams
                const now = new Date();
                const availableExams = await db.exam.findMany({
                    where: {
                        published: true,
                        // TODO: Add startDate/endDate logic if schema supports it
                    },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        category: true,
                        difficulty: true,
                        durationMinutes: true,
                        totalPoints: true,
                        // NO questions returned here
                    },
                    orderBy: { createdAt: 'desc' }
                });
                return res.status(200).json(availableExams);
            }

            // Admin View: All exams with questions
            const role = user.role as string;
            // Use string checks to be safe against stale Prisma Client enums
            if (role !== 'ADMIN' && role !== 'TUTOR' && role !== 'SUPERADMIN') {
                // Fallback for basic users querying without mode
                return res.status(403).json({ error: 'Access denied' });
            }

            const exams = await db.exam.findMany({
                include: {
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            type: true,
                            options: true,
                            points: true,
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return res.status(200).json(exams);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch exams' });
        }
    }

    // POST: Create Exam
    if (req.method === 'POST') {
        const role = user.role as string;
        if (role !== 'ADMIN' && role !== 'TUTOR' && role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            const { questions, ...examData } = req.body;

            const newExam = await db.exam.create({
                data: {
                    ...examData,
                    questions: {
                        create: questions.map((q: any) => ({
                            type: q.type,
                            text: q.text,
                            options: q.options,
                            correctAnswer: q.correctAnswer, // Stored securely
                            points: q.points
                        }))
                    }
                },
                include: { questions: true }
            });
            return res.status(200).json(newExam);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to create exam' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
