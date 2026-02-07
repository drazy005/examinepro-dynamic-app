
import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { authLib } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        steps: [],
        env: {
            NODE_ENV: process.env.NODE_ENV,
            has_DATABASE_URL: !!process.env.DATABASE_URL,
            has_JWT_SECRET: !!process.env.JWT_SECRET
        }
    };

    try {
        // 1. Test Auth Imports and Hashing
        report.steps.push('Testing AuthLib...');
        const hash = await authLib.hashPassword('test');
        report.authHash = hash;
        report.steps.push('AuthLib Hash Success');

        // 2. Test DB Connection
        report.steps.push('Testing DB Connection...');
        const userCount = await db.user.count();
        report.userCount = userCount;
        report.steps.push('DB Connection Success');

        return res.status(200).json(report);
    } catch (error: any) {
        console.error('Debug Endpoint Error:', error);
        report.error = {
            message: error.message,
            stack: error.stack,
            name: error.name
        };
        return res.status(500).json(report);
    }
}
