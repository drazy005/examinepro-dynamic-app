
import { db } from '../api/_lib/db';
import { authLib } from '../api/_lib/auth';
import examHandler from '../api/exams/[[...route]]';
import submissionHandler from '../api/submissions/[[...route]]';

const mockReq = (method: string, query: any, body: any, token: string) => ({
    method,
    query,
    body,
    headers: {
        cookie: `auth_token=${token}`
    }
} as any);

const mockRes = () => {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        console.log(`[Response ${res.statusCode}]:`, JSON.stringify(data, null, 2));
        return res;
    };
    res.setHeader = () => { };
    return res;
};

async function main() {
    console.log("--- Starting Debug Session ---");

    // 1. Check DB Schema
    try {
        console.log("Checking Exam table columns...");
        const columns = await db.$queryRaw`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Exam';
        `;
        console.log("Columns:", JSON.stringify(columns));
    } catch (e) {
        console.error("DB Connection/Query Error:", e);
    }

    // 2. Get Admin User
    const admin = await db.user.findFirst({ where: { role: 'SUPERADMIN' } });
    if (!admin) {
        console.error("No Admin user found!");
        return;
    }
    console.log("Using Admin:", admin.email);
    const token = authLib.signToken({ userId: admin.id, role: admin.role, email: admin.email });

    // 3. Test GET Exams
    console.log("\n--- Testing GET /api/exams ---");
    await examHandler(mockReq('GET', {}, {}, token), mockRes());

    // 4. Test POST Exam (Create)
    console.log("\n--- Testing POST /api/exams ---");
    const newExam = {
        title: "Debug Exam " + Date.now(),
        resourceLink: "https://example.com/resource",
        questions: []
    };
    await examHandler(mockReq('POST', {}, newExam, token), mockRes());

    // 3b. Test GET Exams (Available Mode - Candidate)
    console.log("\n--- Testing GET /api/exams?mode=available ---");
    // Need a candidate token? Or just use admin (should see none if they have submissions, or all if none?)
    // Logic: submissions: { none: { userId: ... } }
    // Let's create a fresh candidate to be sure.
    const candidateEmail = `cand_${Date.now()}@test.com`;
    const candidate = await db.user.create({ data: { email: candidateEmail, role: 'CANDIDATE', name: "Debug Cand", passwordHash: "x", isVerified: true } as any });
    const candToken = authLib.signToken({ userId: candidate.id, role: 'CANDIDATE', email: candidate.email });

    await examHandler(mockReq('GET', { mode: 'available' }, {}, candToken), mockRes());

    // 5. Test GET Submissions (with more logging)
    console.log("\n--- Testing GET /api/submissions ---");
    try {
        await submissionHandler(mockReq('GET', { page: 1, limit: 10 }, {}, token), mockRes());
    } catch (e) {
        console.error("Submission Handler Failed:", e);
    }

    // Clean up candidate
    await db.user.delete({ where: { id: candidate.id } });

    console.log("\n--- Debug Session Complete ---");
    process.exit(0);
}

main().catch(console.error);
