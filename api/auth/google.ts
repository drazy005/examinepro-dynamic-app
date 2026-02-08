
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { GoogleUser, getGoogleAuthUrl, getGoogleUser, signToken } from './_lib/auth.js';
import { parse } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Redirect to Google (GET w/o code)
    if (req.method === 'GET' && !req.query.code) {
        const url = getGoogleAuthUrl();
        return res.redirect(url);
    }

    // 2. Callback (GET w/ code)
    if (req.method === 'GET' && req.query.code) {
        try {
            const { code } = req.query;
            const googleUser = await getGoogleUser(code as string);

            // Find or Create User
            let user = await db.user.findUnique({ where: { email: googleUser.email } });

            if (!user) {
                // Determine Role (First user = SUPERADMIN)
                const userCount = await db.user.count();
                const role = userCount === 0 ? 'SUPERADMIN' : 'CANDIDATE';

                user = await db.user.create({
                    data: {
                        email: googleUser.email,
                        name: googleUser.name,
                        googleId: googleUser.id,
                        avatarUrl: googleUser.picture,
                        role,
                        isVerified: true,
                        passwordHash: '' // No password for OAuth users
                    }
                });
            } else {
                // Update Google metadata
                await db.user.update({
                    where: { id: user.id },
                    data: {
                        googleId: googleUser.id,
                        avatarUrl: googleUser.picture,
                        lastActive: new Date()
                    }
                });
            }

            // Issue Token
            const token = signToken({
                userId: user.id,
                email: user.email,
                role: user.role
            });

            // Set Cookie
            res.setHeader('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);

            // Redirect to Dashboard
            return res.redirect('/');
        } catch (error: any) {
            console.error('Google Auth Error:', error);
            return res.redirect('/login?error=GoogleAuthFailed');
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
