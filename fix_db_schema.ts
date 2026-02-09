
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Schema Fix (Sequential)...');

    // 1. Extension
    try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        console.log('Extension checked.');
    } catch (e: any) {
        console.log('Extension error (ignored):', e.message);
    }

    // 2. Enum
    try {
        // Postgres doesn't support IF NOT EXISTS for TYPE easily in all versions, so we catch error
        await prisma.$executeRawUnsafe(`CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'SBA', 'THEORY');`);
        console.log('Enum created.');
    } catch (e: any) {
        // If error, assume it exists or check message
        if (e.message.includes('already exists')) {
            console.log('Enum already exists.');
        } else {
            console.log('Enum error (ignored):', e.message);
        }
    }

    // 3. Drop Table
    try {
        console.log('Dropping Question table...');
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "Question" CASCADE;`);
    } catch (e: any) {
        console.error('Drop table failed:', e.message);
        // If drop fails, maybe we can't create. But let's try.
    }

    // 4. Create Table
    try {
        console.log('Creating Question table...');
        await prisma.$executeRawUnsafe(`
          CREATE TABLE "Question" (
              "id" TEXT NOT NULL,
              "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
              "text" TEXT NOT NULL,
              "options" TEXT[],
              "correctAnswer" TEXT NOT NULL,
              "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
              "imageUrl" TEXT,
              "category" TEXT,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "authorId" TEXT,

              CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
          );
      `);
        console.log('Question table created.');
    } catch (e: any) {
        console.error('Create table failed:', e.message);
        // Critical error if this fails
    }

    // 5. Relations
    try {
        console.log('Adding Foreign Keys...');
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Question" ADD CONSTRAINT "Question_authorId_fkey" 
          FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
    } catch (e: any) {
        console.log('FK error (might exist):', e.message);
    }

    // 6. Many-to-Many Tables
    try {
        console.log('Fixing _ExamQuestions...');
        await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_ExamQuestions" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);`);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "_ExamQuestions_AB_unique" ON "_ExamQuestions"("A", "B");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "_ExamQuestions_B_index" ON "_ExamQuestions"("B");`);

        // Clean constraints
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "_ExamQuestions" DROP CONSTRAINT IF EXISTS "_ExamQuestions_A_fkey";`); } catch { }
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "_ExamQuestions" DROP CONSTRAINT IF EXISTS "_ExamQuestions_B_fkey";`); } catch { }

        await prisma.$executeRawUnsafe(`
          ALTER TABLE "_ExamQuestions" ADD CONSTRAINT "_ExamQuestions_A_fkey" FOREIGN KEY ("A") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "_ExamQuestions" ADD CONSTRAINT "_ExamQuestions_B_fkey" FOREIGN KEY ("B") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
        console.log('_ExamQuestions fixed.');
    } catch (e: any) {
        console.error('_ExamQuestions error:', e.message);
    }

    try {
        console.log('Fixing _QuestionCollaborators...');
        await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_QuestionCollaborators" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);`);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "_QuestionCollaborators_AB_unique" ON "_QuestionCollaborators"("A", "B");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "_QuestionCollaborators_B_index" ON "_QuestionCollaborators"("B");`);

        try { await prisma.$executeRawUnsafe(`ALTER TABLE "_QuestionCollaborators" DROP CONSTRAINT IF EXISTS "_QuestionCollaborators_A_fkey";`); } catch { }
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "_QuestionCollaborators" DROP CONSTRAINT IF EXISTS "_QuestionCollaborators_B_fkey";`); } catch { }

        await prisma.$executeRawUnsafe(`
          ALTER TABLE "_QuestionCollaborators" ADD CONSTRAINT "_QuestionCollaborators_A_fkey" FOREIGN KEY ("A") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "_QuestionCollaborators" ADD CONSTRAINT "_QuestionCollaborators_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
        console.log('_QuestionCollaborators fixed.');
    } catch (e: any) {
        console.error('_QuestionCollaborators error:', e.message);
    }

    console.log('Sequential Schema Fix Complete.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
