import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../lib/db';
import { authLib } from '../../lib/auth';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await authLib.hashPassword(password);

        // First user is SUPERADMIN, others are BASIC
        const userCount = await db.user.count();
        const role = userCount === 0 ? UserRole.SUPERADMIN : UserRole.BASIC;

        const newUser = await db.user.create({
            data: {
                email,
                name,
                passwordHash,
                role,
                isVerified: true // Auto-verify for simplicity in this MVP
            }
        });

        // Auto-login after register
        const token = authLib.signToken({ userId: newUser.id, role: newUser.role });
        const cookie = authLib.createCookie(token);
        res.setHeader('Set-Cookie', cookie);

        return res.status(200).json({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role
        });

    } catch (error: any) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
