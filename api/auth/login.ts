import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await db.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Use generic error for security
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // In a real app, passwords would be hashed.
        // For this refactor, if we are migrating existing users who might have plain text passwords
        // from the in-memory store, we should handle that.
        // BUT, since we are setting up a NEW DB, we assume new passwords are hashed.
        // For dev ease, if password doesn't match hash, we check plain text (ONLY FOR TRANSITION)

        let isValid = false;
        // Check if stored password is a hash (bcrypt hashes start with $2a$ or similar)
        if (user.passwordHash.startsWith('$')) {
            isValid = await authLib.verifyPassword(password, user.passwordHash);
        } else {
            // Fallback for migrated plain text data (should be re-hashed in a real migration script)
            isValid = user.passwordHash === password;
        }

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate Token
        const token = authLib.signToken({ userId: user.id, role: user.role });

        // Set Cookie
        const cookie = authLib.createCookie(token);

        // Update last active
        await db.user.update({
            where: { id: user.id },
            data: { lastActive: new Date() }
        });

        res.setHeader('Set-Cookie', cookie);
        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error: any) {
        console.error('Login error:', error);
        console.error('Login error:', error);
        // Return actual error message during debugging phase to help user
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
