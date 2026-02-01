import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { emailLib } from '../_lib/email.js';
import { parse } from 'cookie';
import { UserRole } from '../../services/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Check Auth - SUPERADMIN ONLY
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = authLib.verifyToken(token);
    if (!payload || (payload.role as string) !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { subject, message, targetRole } = req.body;

    if (!subject || !message) {
        return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Determine Recipients
    let whereClause: any = {};
    if (targetRole && targetRole !== 'ALL') {
        whereClause.role = targetRole;
    }

    try {
        const recipients = await db.user.findMany({
            where: whereClause,
            select: { email: true, name: true }
        });

        if (recipients.length === 0) {
            return res.status(200).json({ success: true, count: 0, message: 'No recipients found' });
        }

        // Send - In production, use a queue (e.g., Redis/Bull). 
        // For this Vercel function, we'll limit concurrency or just await Promise.all
        // Important: Vercel functions have timeouts. Large lists will fail.
        // Cap at 50 for this immediate version.
        const limitedRecipients = recipients.slice(0, 50);

        let sentCount = 0;
        const promises = limitedRecipients.map(async (user) => {
            const html = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <p>Hello ${user.name},</p>
                    <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #4f46e5; background: #f9fafb;">
                        ${message.replace(/\n/g, '<br/>')}
                    </div>
                    <p style="font-size: 12px; color: #999;">You received this email as a registered user of ExaminePro.</p>
                </div>
            `;
            const success = await emailLib.sendBroadcastEmail(user.email, subject, html);
            if (success) sentCount++;
        });

        await Promise.all(promises);

        return res.status(200).json({
            success: true,
            sent: sentCount,
            total: recipients.length,
            overflow: recipients.length > 50 ? 'Limited to 50 for serverless safety' : undefined
        });

    } catch (e: any) {
        console.error("Broadcast failed:", e);
        return res.status(500).json({ error: 'Failed to broadcast' });
    }
}
