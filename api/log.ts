import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { authLib } from './_lib/auth.js';
import { parse } from 'cookie';
import { sanitize } from '../services/securityService'; // Reuse shared sanitization if possible, or just reimplement simple one

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, details, severity } = req.body;

    if (!action || !details) {
        return res.status(400).json({ error: 'Missing log details' });
    }

    // Try to identify user
    let userId: string | undefined;
    try {
        const cookies = parse(req.headers.cookie || '');
        const token = cookies.auth_token;
        if (token) {
            const payload = authLib.verifyToken(token) as any; // Cast to any to bypass strict type check for now if interface is hidden
            if (payload) {
                userId = payload.userId || payload.id || payload.sub;
            }
        }
    } catch (e) {
        // Anonymous log ok
    }

    try {
        await db.auditLog.create({
            data: {
                action: String(action).substring(0, 50),
                // Prepend severity to details since AuditLog table lacks 'severity' column
                details: `[${(['INFO', 'WARN', 'CRITICAL'].includes(severity) ? severity : 'INFO')}] ${String(details).substring(0, 480)}`,
                timestamp: new Date(),
                user: userId ? { connect: { id: userId } } : undefined
            }
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Log Write Failed:", error);
        return res.status(500).json({ error: 'Failed to record log' });
    }
}
