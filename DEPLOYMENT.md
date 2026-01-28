# Deployment Guide: Vercel & Supabase

This guide outlines the steps to deploy your **ExaminePro Dynamic App** using **Vercel** (frontend & serverless functions) and **Supabase** (PostgreSQL database).

## 1. Supabase Setup (Database)

1.  **Create a Project**: Log in to [Supabase](https://supabase.com/) and create a new project.
2.  **Get Database Credentials**:
    *   Go to **Project Settings** > **Database**.
    *   Scroll down to **Connection parameters**.
    *   Note your `Host`, `User`, `Password`, `Port`, and `Database Name`.
3.  **Connection Pooling (Critical for Serverless)**:
    *   Supabase provides a connection pooler (Supavisor). This is essential for Vercel/Prisma.
    *   In the **Connection String** section, verify you have two distinct URLs:
        *   **Transaction Mode** (Port 6543): Use this for `DATABASE_URL`.
        *   **Session Mode** (Port 5432): Use this for `DIRECT_URL`.

## 2. Environment Variables

You need to configure these variables in both your **local environment** (`.env`) and your **Vercel Project Settings**.

### Required Variables

| Variable Name | Description | Value Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | The *Connection Pooler* URL (Transaction mode). | `postgres://[user]:[pass]@[host]:6543/[db]?pgbouncer=true` |
| `DIRECT_URL` | The *Direct* URL (or Session mode) for migrations. | `postgres://[user]:[pass]@[host]:5432/[db]` |
| `JWT_SECRET` | Secret key for signing authentication tokens. | `your-super-secret-long-random-string` |
| `NODE_ENV` | Environment mode. | `production` (on Vercel), `development` (locally) |

> **Note**: Your `schema.prisma` is already configured to use `directUrl`. This ensures that migration commands use the direct connection while the app uses the connection pooler.

## 3. Database Migration

Before deploying the code, you must sync your database schema with Supabase.

1.  **Set up your local `.env`**:
    Create a `.env` file in the root directory with the values from Step 2.
2.  **Run the push command**:
    ```bash
    npx prisma db push
    ```
    This will create the tables (`User`, `Exam`, `Submission`, etc.) in your Supabase database.

> **IMPORTANT: Manual Migration Workaround**
> If you encounter connection errors (e.g., P1001) or cannot connect locally, you must run the provided SQL scripts directly in the **Supabase SQL Editor** in this exact order:
> 1. `migration_step1_enums.sql` (Adds User Roles)
> 2. `migration_step2_data.sql` (Updates User Data)
> 3. `migration_step3_schema_update.sql` (Updates Exam/Submission Headers)
>
> Once these are run, your database will be ready for deployment even if `prisma db push` fails locally.

## 4. Vercel Deployment

1.  **Push Code to GitHub**: Ensure your latest changes (including `package.json` updates and `vercel.json`) are pushed to your main branch.
2.  **Import Project in Vercel**:
    *   Go to your [Vercel Dashboard](https://vercel.com/dashboard).
    *   Click **Add New...** > **Project**.
    *   Import your `examinepro-dynamic-app` repository.
3.  **Project Settings**:
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Root Directory**: `./` (default).
    *   **Build Command**: `npx prisma generate && vite build` (configured in `package.json`, but good to verify).
    *   **Output Directory**: `dist` (default).
4.  **Environment Variables**:
    *   Expand the **Environment Variables** section.
    *   Add `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` with the values from Supabase.
5.  **Deploy**: Click **Deploy**.

## Troubleshooting

- **Build Fails (`Prisma Client`)**: Ensure `npx prisma generate` is running before build. We added this to your `package.json` build script.
- **SPA Routing Issues**: If refreshing a page gives 404, ensure `vercel.json` is present (I have created this for you).
- **Database Connection Errors**: Double check you are using the Transaction Mode (Port 6543) for `DATABASE_URL`.
