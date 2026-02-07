
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db.js';
import { authLib } from '../../_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid ID' });

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = authLib.verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const role = user.role as string;
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);

    if (!isAdmin) return res.status(403).json({ error: 'Access denied' });

    try {
        // Release all submissions for this exam
        await db.submission.updateMany({
            where: { examId: id },
            data: { resultsReleased: true }
        });
        // Also update exam setting to INSTANT so future submissions are released? 
        // Or keep it manual? Assuming manual release implies we want to change mode or just one-off release.
        // Let's just release existing submissions as per "Release Results" button intent.

        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: 'Failed to release results' });
    }
}
