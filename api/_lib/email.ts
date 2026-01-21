import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || '"ExaminePro System" <noreply@examinepro.com>';

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

export const emailLib = {
    sendVerificationEmail: async (to: string, token: string) => {
        if (!SMTP_HOST) {
            console.log('Skipping email (no SMTP_HOST):', to, token);
            return;
        }

        const link = `${process.env.APP_URL || 'http://localhost:3000'}/verify?token=${token}`;

        await transporter.sendMail({
            from: SMTP_FROM,
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
        if (!SMTP_HOST) return;

        const link = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

        await transporter.sendMail({
            from: SMTP_FROM,
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
    }
};
