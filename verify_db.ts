
import { PrismaClient } from '@prisma/client';

// Use the DATABASE_URL from env (port 6543)
const prisma = new PrismaClient();

async function main() {
    console.log('Testing connection to DATABASE_URL...');
    try {
        // Simple query to check connection
        const count = await prisma.user.count();
        console.log(`Connection Successful! User count: ${count}`);
    } catch (e: any) {
        console.error('Connection Failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
