import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';
import { authLib } from '../_lib/auth';
import { emailLib } from '../_lib/email';
import { parse } from 'cookie';

import crypto from 'crypto';
import { checkRateLimit } from '../_lib/rateLimit';

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
            case 'forgot': return await handleForgot(req, res);
            case 'reset': return await handleReset(req, res);
            case 'logout': return await handleLogout(req, res);
            default: return res.status(404).json({ error: 'Endpoint not found' });
        }
    } catch (error: any) {
        console.error(`Auth Error [${action}]:`, error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

async function handleForgot(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await db.user.findUnique({ where: { email } });
    if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        await db.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry } as any
        });

        try {
            await emailLib.sendPasswordResetEmail(email, resetToken);
        } catch (e) {
            console.error('Failed to send reset email:', e);
        }
    }

    // Always return success to prevent email enumeration
    return res.status(200).json({ message: 'If email exists, reset link sent' });
}

async function handleReset(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and password required' });

    // Find user with valid token and expiry
    const users = await db.user.findMany({
        where: {
            resetToken: token,
            // resetTokenExpiry: { gt: new Date() } // Prisma doesn't support 'gt' on Date field directly in every provider version cleanly without strict typing, but let's try or filter in JS
        }
    });

    const user = users.find(u => u.resetTokenExpiry && u.resetTokenExpiry > new Date());

    if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await authLib.hashPassword(newPassword);

    await db.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            resetToken: null,
            resetTokenExpiry: null
        } as any
    });

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: `Method not allowed. Received: ${req.method}, Expected: POST`
        });
    }

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    // Rate Limit: 5 attempts per 15 minutes per IP (approximated by email here to avoid proxy issues, or both)
    // Using email as key prevents locking out whole office, but allows user enumeration/lockout attack.
    // Better: IP + Email combo or just IP. Let's use IP if available, fallback to email prefix.
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `login_${ip}_${email}`;

    if (!(await checkRateLimit(rateLimitKey, 5, 900))) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }

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
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: `Method not allowed. Received: ${req.method}, Expected: POST`
        });
    }

    const { email, password, name, role: requestedRole } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await authLib.hashPassword(password);

    // Strict Role Policy: All new registrations are CANDIDATE.
    // Upgrades to ADMIN/SUPERADMIN must be done via Database.
    const role = 'CANDIDATE';

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const newUser = await db.user.create({
        data: {
            email, name, passwordHash, role,
            isVerified: false,
            verificationToken
        } as any
    });

    try {
        await emailLib.sendVerificationEmail(email, verificationToken);
    } catch (e) {
        console.error('Failed to send verification email:', e);
    }

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
