-- Add 'reviewed' column to Exam table
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN NOT NULL DEFAULT false;
