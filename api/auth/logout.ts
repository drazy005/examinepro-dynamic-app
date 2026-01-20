import { VercelRequest, VercelResponse } from '@vercel/node';
import { authLib } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const cookie = authLib.removeCookie();

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true });
}
