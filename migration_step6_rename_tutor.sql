-- STEP 6: RENAME TUTOR to ADMIN
-- This reconciles the database with the user's strict requirement for ADMIN role.

-- 1. Updates existing TUTOR users to ADMIN
-- Note: Since this is an enum in Postgres, we might need to modify the type or cast.
-- Approach: Update the data, then (optional) fix type. 
-- If 'ADMIN' is not in the Enum yet, we must add it.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- 2. Migrate data
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "role"::text = 'TUTOR';

-- 3. (Optional) Cleanup - Removing 'TUTOR' from Enum is hard in Postgres without dropping.
-- We will leave 'TUTOR' in the enum for safety but ensure no rows use it.
-- Any future 'TUTOR' references in code are gone, so it will sit unused.

-- 4. Verify
SELECT "id", "email", "role" FROM "User" WHERE "role"::text = 'ADMIN';
