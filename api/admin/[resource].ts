import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
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
        const validLogs = logs.map(l => ({
            ...l,
            timestamp: l.timestamp.getTime(),
            userName: l.user?.name || 'Unknown User'
        }));
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
            // Ensure authorId is valid (use the current admin's ID from token payload)
            if (!user.userId) {
                console.error('Missing userId in token payload:', user);
                return res.status(403).json({ error: 'Invalid session' });
            }

            const data = {
                title: p.title,
                content: p.content,
                published: p.published !== undefined ? p.published : true,
                authorId: user.userId // Corrected: use userId from payload
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
