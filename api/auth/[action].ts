import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';
import { parse } from 'cookie';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (!action || typeof action !== 'string') {
        return res.status(400).json({ error: 'Invalid action' });
    }

    try {
        switch (action) {
            case 'login': return await handleLogin(req, res);
            case 'register': return await handleRegister(req, res);
            case 'me': return await handleMe(req, res);
            case 'logout': return await handleLogout(req, res);
            default: return res.status(404).json({ error: 'Endpoint not found' });
        }
    } catch (error: any) {
        console.error(`Auth Error [${action}]:`, error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let isValid = false;
    if (user.passwordHash.startsWith('$')) {
        isValid = await authLib.verifyPassword(password, user.passwordHash);
    } else {
        isValid = user.passwordHash === password;
    }

    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = authLib.signToken({ userId: user.id, role: user.role });
    const cookie = authLib.createCookie(token);

    // Update last active async (don't await to speed up response)
    db.user.update({ where: { id: user.id }, data: { lastActive: new Date() } }).catch(console.error);

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await authLib.hashPassword(password);
    const userCount = await db.user.count();
    const role = userCount === 0 ? UserRole.SUPERADMIN : UserRole.BASIC;

    const newUser = await db.user.create({
        data: { email, name, passwordHash, role, isVerified: true }
    });

    const token = authLib.signToken({ userId: newUser.id, role: newUser.role });
    const cookie = authLib.createCookie(token);

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({
        id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role
    });
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'No session' });

    const payload = authLib.verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });

    const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, role: true, isVerified: true }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });
    return res.status(200).json(user);
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const cookie = authLib.removeCookie();
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true });
}
