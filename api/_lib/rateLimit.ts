
import { db } from './db';

export async function checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = new Date();
    // const windowStart = new Date(now.getTime() - windowSeconds * 1000); // Unused

    try {
        const entry = await db.rateLimit.findUnique({
            where: { key: identifier }
        });

        if (!entry || entry.expireAt < now) {
            // Create or Reset
            await db.rateLimit.upsert({
                where: { key: identifier },
                update: {
                    points: 1,
                    expireAt: new Date(now.getTime() + windowSeconds * 1000)
                },
                create: {
                    key: identifier,
                    points: 1,
                    expireAt: new Date(now.getTime() + windowSeconds * 1000)
                }
            });
            return true;
        }

        if (entry.points >= limit) {
            return false;
        }

        // Increment
        await db.rateLimit.update({
            where: { key: identifier },
            data: { points: { increment: 1 } }
        });

        return true;
    } catch (e) {
        console.error('RateLimit Error:', e);
        // Fail open if DB is down? Or closed?
        // Let's fail open to not block users if rate limit DB is glitchy, but log it.
        return true;
    }
}
