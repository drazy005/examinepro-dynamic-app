
import { db } from './api/_lib/db.js';

async function main() {
    console.log('Checking Exams in DB...');
    const exams = await db.exam.findMany({});
    console.log(`Total Exams: ${exams.length}`);
    const published = exams.filter(e => e.published);
    console.log(`Published Exams: ${published.length}`);

    published.forEach(e => {
        console.log(`- [${e.id}] ${e.title} (Published: ${e.published})`);
    });

    const unpublished = exams.filter(e => !e.published);
    if (unpublished.length > 0) {
        console.log('Unpublished Exams:');
        unpublished.forEach(e => {
            console.log(`- [${e.id}] ${e.title} (Published: ${e.published})`);
        });
    }
}

main().catch(console.error).finally(() => process.exit());
