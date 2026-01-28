-- STEP 2: MIGRATE DATA
-- Run this script SECOND (after running step 1).

-- 1. Migrate Data (Map old roles to new roles)
-- Basic -> Candidate
UPDATE "User" SET "role" = 'CANDIDATE' WHERE "role"::text = 'BASIC';
-- Admin -> Tutor
UPDATE "User" SET "role" = 'TUTOR' WHERE "role"::text = 'ADMIN';

-- 2. Update Default Value (Safe to run)
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CANDIDATE'::"UserRole";

-- 3. Ensure SystemSettings exists (from v2 upgrade - harmless if exists)
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);
