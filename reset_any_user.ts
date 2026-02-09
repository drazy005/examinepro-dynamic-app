
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.log('Usage: npx tsx reset_any_user.ts <email> <password>');
        return;
    }

    console.log(`Resetting password for ${email}...`);
    // Handle bcryptjs import nuance if any, though * as usually works
    const hashFn = bcrypt.hash || (bcrypt as any).default?.hash;
    const hash = await hashFn(password, 10);

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { passwordHash: hash }
        });
        console.log(`Success! Password for ${user.email} updated.`);
        console.log(`New Hash: ${hash.substring(0, 15)}...`);
    } catch (e: any) {
        console.error(`Failed to update user: ${e.message}`);
        // Check if user exists
        if (e.code === 'P2025') {
            console.error('User not found.');
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
