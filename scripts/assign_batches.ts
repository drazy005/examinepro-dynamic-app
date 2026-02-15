
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
    console.log('Fetching ALL questions to normalize batch IDs...');
    const questions = await db.question.findMany({
        select: { id: true },
        orderBy: { createdAt: 'asc' } // Ensure deterministic order
    });

    console.log(`Found ${questions.length} total questions.`);

    if (questions.length === 0) {
        console.log('No questions to update.');
        return;
    }

    const batchSize = Math.ceil(questions.length / 4);
    const batches = ['BATCH_AUTO_001', 'BATCH_AUTO_002', 'BATCH_AUTO_003', 'BATCH_AUTO_004'];

    for (let i = 0; i < 4; i++) {
        const batchName = batches[i];
        const chunk = questions.slice(i * batchSize, (i + 1) * batchSize);
        const ids = chunk.map(q => q.id);

        if (ids.length > 0) {
            console.log(`Assigning ${ids.length} questions to ${batchName}...`);
            await db.question.updateMany({
                where: { id: { in: ids } },
                data: { batchId: batchName }
            });
        }
    }

    console.log('Migration complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
