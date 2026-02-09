
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to DB...');
    try {
        const users = await prisma.user.findMany();
        console.log(`Found ${users.length} users.`);
        users.forEach(u => {
            const hash = u.passwordHash || '';
            let type = 'unknown';
            if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
                type = 'bcrypt (' + hash.substring(0, 3) + ')';
            } else if (hash.length < 20) {
                type = 'plain-text?';
            }

            console.log(`User: ${u.email} | Role: ${u.role} | HashType: ${type} | Hash: ${hash.substring(0, 15)}...`);
        });
    } catch (e) {
        console.error('Error:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
