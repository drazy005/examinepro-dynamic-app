import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests for quick browser test
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER ? 'Set (***)' : 'Not Set',
        pass: process.env.SMTP_PASS ? 'Set (***)' : 'Not Set',
    };

    console.log('Debug Email Config:', smtpConfig);

    if (!process.env.SMTP_HOST) {
        return res.status(500).json({ error: 'SMTP_HOST is missing in environment variables', config: smtpConfig });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Verify connection configuration
        await transporter.verify();

        return res.status(200).json({
            status: 'Connection Successful',
            message: 'SMTP credentials are valid. The server is ready to take our messages.',
            config: smtpConfig
        });

    } catch (error: any) {
        return res.status(500).json({
            status: 'Connection Failed',
            error: error.message,
            code: error.code,
            command: error.command
        });
    }
}
