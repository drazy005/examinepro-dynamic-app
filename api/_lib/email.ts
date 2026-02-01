import nodemailer from 'nodemailer';
import { db } from './db.js';
import { SystemSettings, SmtpConfig } from '../../services/types.js'; // Ensure correct import path or redefine type if used in backend only context

// Backend-only interface for clarity if types sharing is complex
interface LocalSmtpConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
    secure: boolean;
}

// Fallback ENV config
const ENV_SMTP = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || '"ExaminePro System" <noreply@examinepro.com>'
};

// Create reusable transporter lazily
const getTransporter = async () => {
    // 1. Try DB Config first
    try {
        const settingsRecord = await db.systemSettings.findUnique({ where: { key: 'smtpConfig' } });
        if (settingsRecord && settingsRecord.value) {
            const dbConfig: LocalSmtpConfig = JSON.parse(settingsRecord.value);
            return nodemailer.createTransport({
                host: dbConfig.host,
                port: dbConfig.port,
                secure: dbConfig.secure,
                auth: {
                    user: dbConfig.user,
                    pass: dbConfig.pass,
                },
            });
        }
    } catch (e) {
        console.warn('Failed to load SMTP config from DB, falling back to ENV.', e);
    }

    // 2. Fallback to ENV
    if (ENV_SMTP.host) {
        return nodemailer.createTransport({
            host: ENV_SMTP.host,
            port: ENV_SMTP.port,
            secure: ENV_SMTP.port === 465,
            auth: {
                user: ENV_SMTP.user,
                pass: ENV_SMTP.pass,
            },
        });
    }

    return null;
};

const getFromAddress = async () => {
    try {
        const settingsRecord = await db.systemSettings.findUnique({ where: { key: 'smtpConfig' } });
        if (settingsRecord && settingsRecord.value) {
            const conf = JSON.parse(settingsRecord.value) as LocalSmtpConfig;
            return `"${conf.fromName}" <${conf.fromEmail}>`;
        }
    } catch { }
    return ENV_SMTP.from;
};

export const emailLib = {
    sendVerificationEmail: async (to: string, token: string) => {
        const mailer = await getTransporter();
        if (!mailer) {
            console.log('Skipping verification email (no config):', to);
            return;
        }

        const link = `${process.env.APP_URL || 'http://localhost:3000'}/verify?token=${token}`;
        const from = await getFromAddress();

        await mailer.sendMail({
            from,
            to,
            subject: 'Verify your Account - ExaminePro',
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Welcome to ExaminePro</h2>
                    <p>Please click the button below to verify your email address:</p>
                    <a href="${link}" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">Or copy this link: ${link}</p>
                </div>
            `
        });
    },

    sendPasswordResetEmail: async (to: string, token: string) => {
        const mailer = await getTransporter();
        if (!mailer) return;

        const link = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        const from = await getFromAddress();

        await mailer.sendMail({
            from,
            to,
            subject: 'Reset Password - ExaminePro',
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset. Click below to proceed:</p>
                    <a href="${link}" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">If you didn't request this, ignore this email.</p>
                </div>
            `
        });
    },

    sendBroadcastEmail: async (to: string, subject: string, htmlContent: string) => {
        const mailer = await getTransporter();
        if (!mailer) return false;

        const from = await getFromAddress();
        try {
            await mailer.sendMail({
                from,
                to,
                subject,
                html: htmlContent
            });
            return true;
        } catch (e) {
            console.error('Failed to send broadcast:', e);
            return false;
        }
    }
};
