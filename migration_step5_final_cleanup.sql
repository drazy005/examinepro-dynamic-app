-- STEP 5: FINAL ROLE CLEANUP
-- Run this to force all users into the 3 valid Schema roles: CANDIDATE, TUTOR, SUPERADMIN.

-- 1. Map 'BASIC' to 'CANDIDATE'
UPDATE "User" 
SET "role" = 'CANDIDATE' 
WHERE "role"::text = 'BASIC';

-- 2. Map 'ADMIN' to 'TUTOR' (Since Prisma Schema defines TUTOR, not ADMIN)
-- If you strictly want "ADMIN", we would need to change the Prisma Schema code. 
-- For now, we map legacy "ADMIN" data to the "TUTOR" role used in the code.
UPDATE "User" 
SET "role" = 'TUTOR' 
WHERE "role"::text = 'ADMIN';

-- 3. Catch-all: Anything else that isn't TUTOR or SUPERADMIN becomes CANDIDATE
UPDATE "User" 
SET "role" = 'CANDIDATE' 
WHERE "role"::text NOT IN ('CANDIDATE', 'TUTOR', 'SUPERADMIN');

-- 4. Verification
SELECT "id", "email", "role" FROM "User";
