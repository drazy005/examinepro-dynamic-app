
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db';
import { authLib } from '../../_lib/auth';
import { UserRole } from '@prisma/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Missing code' });
    }

    try {
        // 1. Get Config
        let clientId = process.env.GOOGLE_CLIENT_ID;
        let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        let redirectUri = process.env.GOOGLE_REDIRECT_URI;

        const settings = await db.systemSettings.findUnique({ where: { key: 'oauthConfig' } });
        if (settings && settings.value) {
            try {
                const config = JSON.parse(settings.value);
                if (config.clientId) clientId = config.clientId;
                if (config.clientSecret) clientSecret = config.clientSecret;
                if (config.redirectUri) redirectUri = config.redirectUri;
            } catch (e) { }
        }

        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'OAuth Not Configured' });
        }

        if (!redirectUri) {
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const host = req.headers.host;
            redirectUri = `${protocol}://${host}/api/auth/google/callback`;
        }

        // 2. Exchange Code for Token
        const tokenParams = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        });

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.id_token) {
            console.error('OAuth Token Error:', tokenData);
            return res.status(400).json({ error: 'Failed to retrieve token from Google' });
        }

        // 3. Get User Profile
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const profile = await userRes.json();

        // profile: { id, email, verified_email, name, given_name, family_name, picture, locale }

        if (!profile.email) {
            return res.status(400).json({ error: 'Email not provided by Google' });
        }

        // 4. Find or Create User
        let user = await db.user.findUnique({ where: { googleId: profile.id } });

        if (!user) {
            // Check by email
            const existingEmailUser = await db.user.findUnique({ where: { email: profile.email } });
            if (existingEmailUser) {
                // Link Account
                user = await db.user.update({
                    where: { id: existingEmailUser.id },
                    data: {
                        googleId: profile.id,
                        avatarUrl: profile.picture
                    }
                });
            } else {
                // Create New
                user = await db.user.create({
                    data: {
                        name: profile.name || 'User',
                        email: profile.email,
                        googleId: profile.id,
                        avatarUrl: profile.picture,
                        passwordHash: 'GOOGLE_OAUTH', // Placeholder
                        role: UserRole.CANDIDATE,
                        isVerified: true // Email verified by Google
                    }
                });
            }
        } else {
            // Update avatar if changed
            if (user.avatarUrl !== profile.picture) {
                await db.user.update({ where: { id: user.id }, data: { avatarUrl: profile.picture } });
            }
        }

        // 5. Session
        const token = authLib.signToken({ userId: user.id, role: user.role });
        const cookie = authLib.createCookie(token);

        res.setHeader('Set-Cookie', cookie);

        // Redirect to home/dashboard
        return res.redirect('/');

    } catch (e) {
        console.error('Callback Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
