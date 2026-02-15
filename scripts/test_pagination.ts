
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
    console.log('Testing DB pagination directly...');
    const limit = 50;
    const page = 1;
    const skip = (page - 1) * limit;

    const questions = await db.question.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Requested limit: ${limit}`);
    console.log(`Returned count: ${questions.length}`);

    if (questions.length > limit) {
        console.error('CRITICAL: Returned more than limit!');
    } else {
        console.log('Pagination seems correct at DB level.');
    }

    await db.$disconnect();
}

main();
