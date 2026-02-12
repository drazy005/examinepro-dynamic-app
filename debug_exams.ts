
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to DB...');
    try {
        const exams = await prisma.exam.findMany({
            include: { questions: { select: { id: true, type: true } } }
        });
        console.log(`Found ${exams.length} exams.`);
        exams.forEach(e => {
            console.log(`Exam: ${e.title} (ID: ${e.id})`);
            console.log(`- Published: ${e.published}`);
            console.log(`- Questions: ${e.questions.length}`);
            console.log(`- AuthorId: ${e.authorId}`);
        });

        const submissions = await prisma.submission.findMany();
        console.log(`\nFound ${submissions.length} submissions.`);

    } catch (e) {
        console.error('Error:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
