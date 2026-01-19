import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Try to connect
        await prisma.$connect();

        // Try a simple query
        const userCount = await prisma.user.count();

        // Check env vars (redacted)
        const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
        const isPooling = dbUrl.includes('6543');
        const isSupabase = dbUrl.includes('supabase');

        return res.status(200).json({
            status: 'OK',
            message: 'Database connection successful',
            userCount,
            envCheck: {
                hasUrl: dbUrl !== 'NOT_SET',
                isPoolingWrapper: isPooling,
                isSupabase,
                urlPrefix: dbUrl.substring(0, 15) + '...' // Safe logging
            }
        });
    } catch (error: any) {
        console.error('DB Test Error:', error);
        return res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            detailedError: error.message,
            code: error.code,
            meta: error.meta
        });
    } finally {
        await prisma.$disconnect();
    }
}
