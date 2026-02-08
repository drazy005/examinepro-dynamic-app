
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (process.env.NODE_ENV === 'production' && !req.query.force) {
        return res.status(403).json({ error: 'Not allowed in production without force flag' });
    }

    try {
        const users = await db.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                passwordHash: true
            }
        });

        const diagnostics = users.map(u => {
            const hash = u.passwordHash || '';
            let type = 'unknown';
            if (hash.startsWith('$2a$')) type = 'bcrypt (2a)';
            else if (hash.startsWith('$2b$')) type = 'bcrypt (2b)';
            else if (hash.startsWith('$2y$')) type = 'bcrypt (2y)';
            else if (hash.startsWith('$argon2')) type = 'argon2';
            else if (hash.length < 20) type = 'plain-text?';
            else type = 'other-hash';

            return {
                email: u.email,
                role: u.role,
                hashPrefix: hash.substring(0, 10) + '...',
                hashType: type,
                length: hash.length
            };
        });

        return res.status(200).json({ count: users.length, users: diagnostics });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
