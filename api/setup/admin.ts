
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db.js';
import { authLib } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (process.env.NODE_ENV === 'production' && !req.query.force) {
        return res.status(403).json({ error: 'Not allowed in production without force flag' });
    }

    const email = 'admin@example.com';
    const password = 'admin';
    const passwordHash = await authLib.hashPassword(password);

    try {
        const user = await db.user.upsert({
            where: { email },
            update: {
                passwordHash,
                role: 'SUPERADMIN',
                isVerified: true
            },
            create: {
                email,
                name: 'Super Admin',
                passwordHash,
                role: 'SUPERADMIN',
                isVerified: true
            }
        });

        return res.status(200).json({ message: 'Admin user created/updated', user: { email, password } });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
