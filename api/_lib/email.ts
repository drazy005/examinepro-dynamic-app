import nodemailer from 'nodemailer';
import { db } from './db.js';
import { SystemSettings, SmtpConfig } from '../../services/types';

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
            // Only use DB config if it has at least a host defined
            if (dbConfig.host && dbConfig.host.trim() !== '') {
                console.log('Using SMTP Config from Database');
                return nodemailer.createTransport({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    secure: dbConfig.secure,
                    auth: {
                        user: dbConfig.user,
                        pass: dbConfig.pass ? dbConfig.pass.replace(/\s+/g, '') : '',
                    },
                });
            }
        }
    } catch (e) {
        console.warn('Failed to load SMTP config from DB, falling back to ENV.', e);
    }

    // 2. Fallback to ENV
    if (ENV_SMTP.host) {
        console.log('Using SMTP Config from Environment Variables');
        return nodemailer.createTransport({
            host: ENV_SMTP.host,
            port: ENV_SMTP.port,
            secure: ENV_SMTP.port === 465,
            auth: {
                user: ENV_SMTP.user,
                pass: ENV_SMTP.pass ? ENV_SMTP.pass.replace(/\s+/g, '') : '',
            },
        });
    }

    console.warn('No SMTP configuration found (DB or ENV).');
    return null;
};

const getFromAddress = async () => {
    try {
        const settingsRecord = await db.systemSettings.findUnique({ where: { key: 'smtpConfig' } });
        if (settingsRecord && settingsRecord.value) {
            const conf = JSON.parse(settingsRecord.value) as LocalSmtpConfig;
            if (conf.fromEmail && conf.fromEmail.trim() !== '') {
                return `"${conf.fromName || 'ExaminePro'}" <${conf.fromEmail}>`;
            }
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
                <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to ExaminePro</h2>
                    <p>Please click the button below to verify your email address:</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                        <tbody>
                            <tr>
                                <td align="center">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                        <tbody>
                                            <tr>
                                                <td> <a href="${link}" target="_blank" style="background-color: #4f46e5; border: solid 1px #4f46e5; border-radius: 5px; box-sizing: border-box; color: #ffffff; cursor: pointer; display: inline-block; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-decoration: none; text-transform: capitalize;">Verify Email</a> </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">Or copy this link: <a href="${link}">${link}</a></p>
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
                <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset. Click below to proceed:</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                        <tbody>
                            <tr>
                                <td align="center">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                        <tbody>
                                            <tr>
                                                <td> <a href="${link}" target="_blank" style="background-color: #4f46e5; border: solid 1px #4f46e5; border-radius: 5px; box-sizing: border-box; color: #ffffff; cursor: pointer; display: inline-block; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-decoration: none; text-transform: capitalize;">Reset Password</a> </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">If you didn't request this, ignore this email.</p>
                    <p style="margin-top: 10px; color: #666; font-size: 12px;">Link: <a href="${link}">${link}</a></p>
                </div>
            `
        });
    },

    sendBroadcastEmail: async (to: string, subject: string, htmlContent: string) => {
        const mailer = await getTransporter();
        if (!mailer) throw new Error("SMTP Configuration missing.");

        const from = await getFromAddress();
        try {
            await mailer.sendMail({
                from,
                to,
                subject,
                html: htmlContent
            });
            return true;
        } catch (e: any) {
            console.error('Failed to send broadcast:', e);
            throw new Error(e.message || "Result: Failed to send email");
        }
    }
};
