
import { api } from './services/api';
// We can't use 'services/api' directly in node script easily without polyfills (fetch).
// Let's use direct DB check for "distinct batchId".

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
    console.log('Checking distinct batchIds in DB...');
    try {
        const batches = await db.question.findMany({
            distinct: ['batchId'],
            select: { batchId: true },
            where: { batchId: { not: null } },
            orderBy: { batchId: 'desc' }
        });
        console.log('Batches found:', batches.map(b => b.batchId));
    } catch (e) { console.error(e); }
    await db.$disconnect();
}
main();
