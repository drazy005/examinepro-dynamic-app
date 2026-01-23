import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db.js';
import { authLib } from '../../_lib/auth.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Auth Check
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    const role = user.role as string;
    if (!user || (role !== 'ADMIN' && role !== 'TUTOR' && role !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const questions = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Invalid payload: Expected array of questions' });
        }

        // Validate basic structure
        const validQuestions = questions.map(q => ({
            id: q.id, // Optional, db handles it usually but we might pass it
            examId: q.examId || '', // Just store in bank if empty, but schema requires examId?
            // Wait, schema says examId is mandatory and relates to Exam.
            // If these are "General Bank" questions, we might need a dummy Exam or make examId optional?
            // Let's check schema.
            // Checking: model Question { examId String ... }
            // So every question MUST belong to an exam. 
            // In the AdminDashboard "Question Bank" view, they often don't belong to a specific exam yet?
            // Actually the current `saveQuestion` likely assigns them to a default or handling it.
            // Let's assume the user selects a "Target Exam" or we create a "Question Bank" holder exam.
            // OR we fix the schema to make examId optional?
            // Let's fix schema to make examId optional if we want a true global bank.
            // For now, I'll assume usage is: Import to specific Exam OR Import to Bank (which might need a dummy ID).

            type: q.type || 'MCQ',
            text: q.text || 'Untitled Question',
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            points: q.points || 1,
            // If schema requires examId, we must provide one. 
            // I will default to a 'Bank' exam if not provided, assuming one exists or handled by frontend?
            // Better: update schema to make examId optional?
            // Let's stick to updating the SCHEMA first to allow global questions.
        }));

        // STOP: I need to check schema first. If examId is required, I can't just bulk insert without it.
        // I'll make the API attempt it, but if it fails, I'll know. 
        // Actually, let's update the schema in parallel. 
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
// Placeholder - I will rewrite this after schema check.
