import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db';
import { authLib } from './_lib/auth';
import { parse } from 'cookie';
import { sanitize } from '../services/securityService';
import { checkRateLimit } from './_lib/rateLimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, details, severity } = req.body;

    if (!action || !details) {
        return res.status(400).json({ error: 'Missing log details' });
    }

    // Rate Limit: 100 logs per 10 mins per IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `log_${ip}`;
    try {
        if (!(await checkRateLimit(rateLimitKey, 100, 600))) {
            return res.status(429).json({ error: 'Too many logs' });
        }
    } catch (e) { /* Ignore rate limit errors if DB is down */ }

    // Try to identify user
    let userId: string | undefined;
    try {
        const cookies = parse(req.headers.cookie || '');
        const token = cookies.auth_token;
        if (token) {
            const payload = authLib.verifyToken(token) as any;
            if (payload) {
                userId = payload.userId || payload.id || payload.sub;
            }
        }
    } catch (e) { }

    // Enforce Authentication
    if (!userId && action !== 'LOGIN_FAILURE' && action !== 'AUTH_ERROR') {
        return res.status(403).json({ error: 'Unauthenticated logging restricted' });
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
