-- MANUAL MIGRATION: Fix User Roles
-- Run this in Supabase SQL Editor to apply changes

-- 1. Add new Enum values (Safe to run multiple times)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CANDIDATE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TUTOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

-- 2. Migrate Data (Map old roles to new roles)
-- Basic -> Candidate
UPDATE "User" SET "role" = 'CANDIDATE' WHERE "role"::text = 'BASIC';
-- Admin -> Tutor
UPDATE "User" SET "role" = 'TUTOR' WHERE "role"::text = 'ADMIN';

-- 3. Update Default Value
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CANDIDATE'::"UserRole";

-- 4. Ensure SystemSettings exists (from v2 upgrade)
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);

-- 5. Enable RLS (Optional, but good practice if not enabled, though App handles logic)
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
