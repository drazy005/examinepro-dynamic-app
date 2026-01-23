-- Upgrade V2: Roles, Settings, and Exam Features

-- 1. Add TUTOR Role (Safe Update)
-- Postgres doesn't support "IF NOT EXISTS" for enum values easily, catch error if needed or strictly run once.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TUTOR';

-- 2. Create SystemSettings Table
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);

-- 3. Create ResultReleaseMode Enum
DO $$ BEGIN
    CREATE TYPE "ResultReleaseMode" AS ENUM ('MANUAL', 'SCHEDULED', 'INSTANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Update Exam Table
ALTER TABLE "Exam" 
ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "warningTimeThreshold" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "resultReleaseMode" "ResultReleaseMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "scheduledReleaseDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "showMcqScoreImmediately" BOOLEAN NOT NULL DEFAULT false;

-- 5. Add default System Settings (Optional, good for init)
INSERT INTO "SystemSettings" ("key", "value") VALUES 
('ai_global_enabled', 'false'),
('theme_mode', 'system'),
('theme_primary_color', '#3b82f6') 
ON CONFLICT DO NOTHING;
