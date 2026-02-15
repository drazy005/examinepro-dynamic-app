
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
    console.log('Fetching questions for diagnostics...');
    const allQuestions = await db.question.findMany({
        select: { id: true, batchId: true, type: true }
    });
    console.log(`Total questions in DB: ${allQuestions.length}`);

    // Count by batchId
    const counts: Record<string, number> = {};
    let unbatched = 0;

    for (const q of allQuestions) {
        const id = q.batchId;
        if (id === null || id === undefined) {
            unbatched++;
        } else if (id === '') {
            unbatched++;
            console.log(`Warning: Empty string batchId found for question ${q.id}`);
        } else {
            counts[id] = (counts[id] || 0) + 1;
        }
    }

    console.log(`Unbatched (null/empty): ${unbatched}`);
    console.log('Batched counts:', counts);
}

main()
    .catch(console.error)
    .finally(async () => {
        await db.$disconnect();
    });
