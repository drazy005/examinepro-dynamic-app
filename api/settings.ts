import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { authLib } from './_lib/auth.js';
import { parse } from 'cookie';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    // 1. GET Settings
    if (req.method === 'GET') {
        try {
            const settings = await db.systemSettings.findMany();
            const config: Record<string, any> = {};

            // Check auth for sensitive keys
            let isSuperAdmin = false;
            if (token) {
                const payload = authLib.verifyToken(token);
                if (payload && (payload.role as string) === 'SUPERADMIN') {
                    isSuperAdmin = true;
                }
            }

            settings.forEach(s => {
                // Parse JSON for complex objects if needed, or keep as string
                // We'll try to parse specific keys we know are JSON
                if (s.key === 'dbConfigs' || s.key === 'apiKeys' || s.key === 'oauthConfig') {
                    if (isSuperAdmin) {
                        try { config[s.key] = JSON.parse(s.value); } catch { config[s.key] = {}; } // Default to empty object/array
                    }
                    // If not superadmin, DO NOT include these keys
                } else if (s.key === 'branding') {
                    // Publicly accessible JSON config
                    try { config[s.key] = JSON.parse(s.value); } catch { config[s.key] = {}; }
                } else {
                    // Public/Common settings
                    config[s.key] = s.value;
                }
            });

            // Ensure booleans are actually booleans for the frontend
            if (config.aiGradingEnabled === 'true') config.aiGradingEnabled = true;
            if (config.aiGradingEnabled === 'false') config.aiGradingEnabled = false;

            if (config.maintenanceMode === 'true') config.maintenanceMode = true;
            if (config.maintenanceMode === 'false') config.maintenanceMode = false;

            return res.status(200).json(config);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }
    }

    // 2. POST Updates - Superadmin Only
    if (req.method === 'POST') {
        if (!token) return res.status(401).json({ error: 'No session' });

        const payload = authLib.verifyToken(token);
        if (!payload || (payload.role as string) !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Unauthorized: Superadmin only' });
        }

        const updates: Record<string, any> = req.body;

        // Validation for sensitive configs
        // Relaxed validation: Allow empty/partial config to support ENV fallback
        if (updates.smtpConfig) {
            // We allow saving whatever is passed. If it's invalid, the emailLib will just fallback or fail at runtime.
            // This supports the "Use .env Defaults" feature where we clear the DB config.
        }

        const prismaPromises = Object.entries(updates).map(([key, value]) => {
            // Serialize objects/arrays to string for storage
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return db.systemSettings.upsert({
                where: { key },
                update: { value: stringValue },
                create: { key, value: stringValue }
            });
        });

        try {
            await db.$transaction(prismaPromises);
            return res.status(200).json({ success: true });
        } catch (error: any) {
            console.error("Settings Update Error:", error);
            // Check for specific Prisma errors if possible, or just return the message
            return res.status(500).json({ error: `Failed to update settings: ${error.message || 'Unknown DB Error'}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
