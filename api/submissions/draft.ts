
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token || req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    try {
        const { submissionId, answers } = req.body;
        if (!submissionId || !answers) return res.status(400).json({ error: 'Missing data' });

        const submission = await db.submission.findUnique({ where: { id: submissionId } });
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.userId !== user.userId && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

        await db.submission.update({
            where: { id: submissionId },
            data: { answersDraft: answers }
        });
        return res.status(200).json({ success: true, savedAt: Date.now() });
    } catch (e) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
