import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        await prisma.$connect();
        console.log('Connected successfully.');

        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);

        const questionCount = await prisma.question.count();
        console.log(`Question count: ${questionCount}`);

        const examCount = await prisma.exam.count();
        console.log(`Exam count: ${examCount}`);

    } catch (e) {
        console.error('Database connection failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
