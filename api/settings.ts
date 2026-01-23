import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    // 1. GET Public Settings (Theme, etc.) - No Auth needed (or lightweight)
    if (req.method === 'GET') {
        try {
            const settings = await db.systemSettings.findMany();
            const config: Record<string, string> = {};
            settings.forEach(s => config[s.key] = s.value);
            return res.status(200).json(config);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }
    }

    // 2. POST Updates - Superadmin Only
    if (req.method === 'POST') {
        if (!token) return res.status(401).json({ error: 'No session' });

        const payload = authLib.verifyToken(token);
        if (!payload || payload.role !== UserRole.SUPERADMIN) {
            return res.status(403).json({ error: 'Unauthorized: Superadmin only' });
        }

        const updates: Record<string, any> = req.body;
        const prismaPromises = Object.entries(updates).map(([key, value]) =>
            db.systemSettings.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            })
        );

        try {
            await db.$transaction(prismaPromises);
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update settings' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
