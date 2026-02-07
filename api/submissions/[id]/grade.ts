
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db.js';
import { authLib } from '../../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token || req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);
    if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

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
