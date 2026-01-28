-- STEP 3: SCHEMA UPDATES
-- Run this script to sync the remaining schema changes (Exam, SystemSettings, Enums).
-- This covers changes that might be in upgrade_v2.sql plus some missing JSON fields.

-- 1. Create ResultReleaseMode Enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "ResultReleaseMode" AS ENUM ('MANUAL', 'SCHEDULED', 'INSTANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update Exam Table (Add missing columns)
ALTER TABLE "Exam" 
ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "warningTimeThreshold" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "resultReleaseMode" "ResultReleaseMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "scheduledReleaseDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "showMcqScoreImmediately" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "timerSettings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "gradingPolicy" JSONB NOT NULL DEFAULT '{}';

-- 3. Ensure SystemSettings exists
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);

-- 4. AuditLog Table (Ensure it exists)
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Add ForeignKey for AuditLog if not exists (Checking constraint existence is complex in pure SQL one-liners, 
-- but creating the table implies we might need the FK. 
-- For now, we assume if table was just created, we need FK. 
-- If table existed, we assume FK exists or we skip to avoid errors. 
-- Safe approach: Try adding FK, ignore if exists.)

DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Default Settings
INSERT INTO "SystemSettings" ("key", "value") VALUES 
('ai_global_enabled', 'false'),
('theme_mode', 'system'),
('theme_primary_color', '#3b82f6') 
ON CONFLICT DO NOTHING;
