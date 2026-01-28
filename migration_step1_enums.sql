-- STEP 1: ADD ENUMS
-- Run this script FIRST.
-- After running, ensure the changes are committed (if using a transaction-based editor, typically Supabase SQL Editor commits automatically after run).

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CANDIDATE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TUTOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';
