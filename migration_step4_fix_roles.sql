-- STEP 4: CLEANUP ROLES
-- Run this to insure only valid roles exist in the database.

-- 1. Update any user with an invalid role to 'CANDIDATE'
-- We cast to text first to avoid enum errors if the value isn't in the enum yet.
UPDATE "User" 
SET "role" = 'CANDIDATE' 
WHERE "role"::text NOT IN ('CANDIDATE', 'TUTOR', 'SUPERADMIN');

-- 2. Verify (Optional Select)
SELECT "id", "email", "role" FROM "User";
