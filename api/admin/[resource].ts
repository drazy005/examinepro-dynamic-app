import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { emailLib } from '../_lib/email.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { resource } = req.query;

    if (!resource || typeof resource !== 'string') {
        return res.status(400).json({ error: 'Invalid resource' });
    }

    // Check Auth
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const user = authLib.verifyToken(token);
    if (!user || ((user.role as string) !== 'ADMIN' && (user.role as string) !== 'SUPERADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        switch (resource) {
            case 'users': return await handleUsers(req, res, user);
            case 'logs': return await handleLogs(req, res, user);
            case 'announcements': return await handleAnnouncements(req, res, user);
            case 'broadcast': return await handleBroadcast(req, res, user);
            case 'test-email': return await handleTestEmail(req, res, user);
            default: return res.status(404).json({ error: 'Resource not found' });
        }
    } catch (error: any) {
        console.error(`Admin Error [${resource}]:`, error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

async function handleUsers(req: VercelRequest, res: VercelResponse, user: any) {
    if (req.method === 'GET') {
        const users = await db.user.findMany({
            select: {
                id: true, name: true, email: true, role: true, isVerified: true, lastActive: true, createdAt: true
            } as any,
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(users);
    }
    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleLogs(req: VercelRequest, res: VercelResponse, user: any) {
    if ((user.role as string) !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'GET') {
        const logs = await db.auditLog.findMany({
            take: 200,
            orderBy: { timestamp: 'desc' },
            include: { user: { select: { name: true, email: true } } }
        });
        const validLogs = logs.map(l => {
            // Extract severity from details if present (e.g. "[INFO] Message")
            const sevMatch = l.details.match(/^\[(INFO|WARN|CRITICAL)\]\s*(.*)/);
            const severity = sevMatch ? sevMatch[1] : 'INFO';
            const cleanDetails = sevMatch ? sevMatch[2] : l.details;

            return {
                ...l,
                details: cleanDetails,
                severity: severity as 'INFO' | 'WARN' | 'CRITICAL',
                timestamp: l.timestamp.getTime(),
                userName: l.user?.name || 'Unknown User'
            };
        });
        return res.status(200).json(validLogs);
    }
    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleAnnouncements(req: VercelRequest, res: VercelResponse, user: any) {
    if (req.method === 'GET') {
        const posts = await db.blogPost.findMany({
            where: { published: true },
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { name: true } } }
        });
        return res.status(200).json(posts.map(p => ({
            ...p,
            createdAt: p.createdAt.getTime(),
            authorName: p.author?.name || 'System'
        })));
    }

    if (req.method === 'POST') {
        if ((user.role as string) !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' });

        const posts = req.body;
        if (!Array.isArray(posts)) return res.status(400).json({ error: 'Invalid format' });

        const results = [];
        for (const p of posts) {
            // Ensure authorId is valid
            const authorId = user.userId || user.id || user.sub;
            if (!authorId) {
                console.error('Missing userId in token payload:', user);
                return res.status(403).json({ error: 'Invalid session' });
            }

            const data = {
                title: p.title,
                content: p.content,
                published: p.published !== undefined ? p.published : true,
                authorId: authorId
            };

            // Use Upsert to handle both New (Client-generated UUID) and Existing
            const saved = await db.blogPost.upsert({
                where: { id: p.id },
                update: data,
                create: {
                    ...data,
                    id: p.id,
                    createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
                }
            });
            results.push(saved);
        }
        return res.status(200).json(results);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleBroadcast(req: VercelRequest, res: VercelResponse, user: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Double check SUPERADMIN
    if ((user.role as string) !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' });

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
        console.log(`Broadcast Target: ${targetRole}, Clause:`, whereClause);
        const recipients = await db.user.findMany({
            where: whereClause,
            select: { email: true, name: true }
        });

        console.log(`Found ${recipients.length} recipients`);

        if (recipients.length === 0) {
            return res.status(200).json({ success: true, count: 0, message: 'No recipients found' });
        }

        // Cap at 50 for this version
        const limitedRecipients = recipients.slice(0, 50);

        let sentCount = 0;
        // Use sequential processing to avoid rate limits or overwhelming SMTP
        for (const u of limitedRecipients) {
            const html = `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <p>Hello ${u.name},</p>
                        <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #4f46e5; background: #f9fafb;">
                            ${message.replace(/\n/g, '<br/>')}
                        </div>
                        <p style="font-size: 12px; color: #999;">You received this email as a registered user of ExaminePro.</p>
                    </div>
                `;
            try {
                await emailLib.sendBroadcastEmail(u.email, subject, html);
                sentCount++;
            } catch (err: any) {
                console.error(`Failed to send to ${u.email}:`, err.message);
            }
        }

        return res.status(200).json({
            success: sentCount > 0,
            sent: sentCount,
            total: recipients.length,
            overflow: recipients.length > 50 ? 'Limited to 50 for safety' : undefined
        });

    } catch (e: any) {
        console.error("Broadcast failed:", e);
        return res.status(500).json({ error: 'Failed to broadcast' });
    }
}

async function handleTestEmail(req: VercelRequest, res: VercelResponse, user: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if ((user.role as string) !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        await emailLib.sendBroadcastEmail(email, 'ExaminePro SMTP Test', '<h1>SMTP Configured Successfully</h1><p>Your email system is working.</p>');
        return res.status(200).json({ success: true, message: 'Test email sent to ' + email });
    } catch (e: any) {
        console.error("Test email failed:", e);
        return res.status(500).json({ success: false, error: 'Test failed: ' + e.message });
    }
}
