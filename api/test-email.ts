import { VercelRequest, VercelResponse } from '@vercel/node';
import { emailLib } from '../_lib/email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow in development or via a secret key if needed, keeping simple for now

    const targetEmail = req.query.to as string;

    if (!targetEmail) {
        return res.status(400).json({
            error: 'Missing recipient email',
            usage: '/api/test-email?to=your-email@example.com',
            env: {
                host: process.env.SMTP_HOST,
                user: process.env.SMTP_USER,
                port: process.env.SMTP_PORT
            }
        });
    }

    try {
        await emailLib.sendVerificationEmail(targetEmail, 'TEST_TOKEN_123');
        return res.status(200).json({
            success: true,
            message: `Test email sent to ${targetEmail}`
        });
    } catch (error: any) {
        console.error('Test Email Failure:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}
