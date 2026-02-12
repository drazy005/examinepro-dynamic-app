
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const userCount = await db.user.count();
        const examCount = await db.exam.count();
        return res.status(200).json({
            status: 'ok',
            database: 'connected',
            counts: { users: userCount, exams: examCount },
            env: {
                node_env: process.env.NODE_ENV,
                has_db_url: !!process.env.DATABASE_URL
            }
        });
    } catch (e: any) {
        return res.status(500).json({
            status: 'error',
            message: e.message,
            code: e.code,
            env: {
                node_env: process.env.NODE_ENV,
                has_db_url: !!process.env.DATABASE_URL
            }
        });
    }
}
