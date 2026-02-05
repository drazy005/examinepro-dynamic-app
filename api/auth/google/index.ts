
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Get Config (DB > Env)
        let clientId = process.env.GOOGLE_CLIENT_ID;
        let redirectUri = process.env.GOOGLE_REDIRECT_URI;

        // Try DB override
        const settings = await db.systemSettings.findUnique({ where: { key: 'oauthConfig' } });
        if (settings && settings.value) {
            try {
                const config = JSON.parse(settings.value);
                if (config.clientId) clientId = config.clientId;
                if (config.redirectUri) redirectUri = config.redirectUri;
            } catch (e) {
                // Ignore JSON error
            }
        }

        if (!clientId) {
            return res.status(500).json({ error: 'Google OAuth not configured (ClientId missing).' });
        }

        // Default Redirect URI if not set
        if (!redirectUri) {
            // Construct from request host
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const host = req.headers.host;
            redirectUri = `${protocol}://${host}/api/auth/google/callback`;
        }

        // 2. Build URL
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'email profile',
            access_type: 'online',
            prompt: 'consent' // Refresh token? Not strictly needed for login but good for re-auth
        });

        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        // 3. Redirect
        return res.redirect(googleAuthUrl);

    } catch (error) {
        console.error('OAuth Init Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
