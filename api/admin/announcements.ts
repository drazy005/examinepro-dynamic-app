import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    let user = null;
    if (token) {
        user = authLib.verifyToken(token);
    }

    // GET: Public (or authenticated) list of announcements
    if (req.method === 'GET') {
        try {
            const posts = await db.blogPost.findMany({
                where: { published: true },
                orderBy: { createdAt: 'desc' },
                include: { author: { select: { name: true } } }
            });
            return res.status(200).json(posts.map(p => ({
                ...p,
                createdAt: p.createdAt.getTime(),
                authorName: p.author.name
            })));
        } catch (e) {
            return res.status(500).json({ error: 'Failed to fetch announcements' });
        }
    }

    // POST: Update/Create (SuperAdmin only)
    if (req.method === 'POST') {
        if (!user || user.role !== UserRole.SUPERADMIN) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // In the current frontend, it sends a bulk update list. 
        // For simplicity with Prisma, we might just upsert them individually or 
        // wipe and recreate. Wiping and recreating is dangerous for IDs.
        // Let's assume we receive an array of posts.

        const posts = req.body;
        if (!Array.isArray(posts)) return res.status(400).json({ error: 'Invalid format' });

        try {
            const results = [];
            for (const p of posts) {
                const data = {
                    title: p.title,
                    content: p.content,
                    published: p.published,
                    authorId: user.userId
                };

                if (p.id && p.id.length > 10) { // Simple check if it's a real ID
                    const updated = await db.blogPost.update({
                        where: { id: p.id },
                        data
                    });
                    results.push(updated);
                } else {
                    const created = await db.blogPost.create({ data });
                    results.push(created);
                }
            }
            return res.status(200).json(results);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Failed to update announcements' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
