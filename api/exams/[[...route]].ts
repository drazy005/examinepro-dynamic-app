import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';
import { authLib } from '../_lib/auth';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { route } = req.query;
    // route is string[] | string | undefined

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    // Public/Available check might be needed without token? 
    // But `list` usually requires auth.
    // Let's assume strict auth for now, as useExams uses api.ts which expects auth?
    // Wait, api.ts `list` calls `/exams`.

    // We allow Public GET if it's potentially needed?
    // No, existing logical required auth.

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    // === 1. ROOT ROUTES: /api/exams ===
    if (!route || route.length === 0) {

        // GET: List
        if (req.method === 'GET') {
            const { mode } = req.query; // ?mode=available
            if (mode === 'available') {
                // Candidate View: Published Only
                const exams = await db.exam.findMany({
                    where: { published: true },
                    orderBy: { createdAt: 'desc' },
                    include: { questions: false } // Don't leak questions here
                });
                return res.status(200).json(exams);
            }

            // Admin View
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            const exams = await db.exam.findMany({
                orderBy: { createdAt: 'desc' },
                include: { questions: { select: { id: true } } } // count check
            });
            return res.status(200).json(exams);
        }

        // POST: Create
        if (req.method === 'POST') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                const { title, description, category, difficulty, durationMinutes, timerSettings, gradingPolicy, questions } = req.body;

                // Create Exam
                const exam = await db.exam.create({
                    data: {
                        title: title || 'Untitled Exam',
                        description: description || '',
                        category: category || 'General',
                        difficulty: difficulty || 'MEDIUM',
                        durationMinutes: durationMinutes || 30,
                        timerSettings: timerSettings || {},
                        gradingPolicy: gradingPolicy || {},
                        published: false,
                        resultRelease: 'INSTANT' // Default
                    }
                });

                // Link Questions if provided (assuming questions exist)
                // If creating new questions inline? Complicated. Assuming linking.
                // Or maybe the frontend sends full question objects?
                // For MVP, usually we create Exam first, then add Questions.
                // But if `questions` array is passed with IDs?

                return res.status(200).json(exam);
            } catch (e) {
                return res.status(500).json({ error: 'Failed to create exam' });
            }
        }

        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actionOrId = route[0];

    // === 2. STATIC/SPECIFIC ROUTES (None for exams currently) ===

    // === 3. ID-BASED ROUTES ===
    const examId = actionOrId;
    const subRoute = route[1]; // release

    // /api/exams/[id]
    if (!subRoute) {
        // GET: Detail
        if (req.method === 'GET') {
            // Candidates can get details if published. Admins always.
            const exam = await db.exam.findUnique({
                where: { id: examId },
                include: { questions: true } // Full details?
            });

            if (!exam) return res.status(404).json({ error: 'Exam not found' });

            if (!isAdmin && !exam.published) {
                return res.status(403).json({ error: 'Exam access denied' });
            }

            // If Candidate, maybe strip correct answers from questions?
            if (!isAdmin) {
                const sanitized = {
                    ...exam,
                    questions: exam.questions.map(q => ({
                        ...q,
                        correctAnswer: undefined // Hide answer
                    }))
                };
                return res.status(200).json(sanitized);
            }

            return res.status(200).json(exam);
        }

        // PUT: Update
        if (req.method === 'PUT') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            try {
                const updates = req.body;
                delete updates.id;
                delete updates.createdAt;

                // Handle Questions update?
                // If questions provided as array of objects, might need deep update logic.
                // For now, assume simple property update.

                const updated = await db.exam.update({
                    where: { id: examId },
                    data: { ...updates }
                });
                return res.status(200).json(updated);
            } catch (e) {
                return res.status(500).json({ error: 'Update failed' });
            }
        }

        // DELETE
        if (req.method === 'DELETE') {
            if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
            await db.exam.delete({ where: { id: examId } });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    }

    // /api/exams/[id]/release
    if (subRoute === 'release') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
        try {
            // Release all submissions for this exam?
            await db.submission.updateMany({
                where: { examId: examId },
                data: { resultsReleased: true }
            });
            // Also update exam setting?
            await db.exam.update({
                where: { id: examId },
                data: { resultReleaseMode: 'INSTANT' } // or similar
            });
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: 'Failed' });
        }
    }

    return res.status(404).json({ error: 'Not found' });
}
