
import { db } from './api/_lib/db.js';

async function main() {
    console.log('Checking Questions in DB...');
    const exams = await db.exam.findMany({
        include: {
            _count: {
                select: { questions: true }
            }
        }
    });

    exams.forEach(e => {
        console.log(`Exam [${e.title}] (ID: ${e.id}): ${e._count.questions} questions. Published: ${e.published}`);
    });
}

main().catch(console.error).finally(() => process.exit());
