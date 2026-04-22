-- Master database setup script (non-seed).
-- This file composes all setup scripts except seed_ta_and_courses.sql.
--
-- Goals:
-- 1) Fresh DB: one-run setup of the full schema.
-- 2) Existing DB: safe re-run without destructive changes.
--
-- Usage (from repo root):
--   psql -U <user> -d <db> -f SQL_SETUP/setupDB_Master.sql

\set ON_ERROR_STOP on

-- Detect whether core init tables exist yet.
SELECT
    CASE
        WHEN to_regclass('public.users') IS NULL
         AND to_regclass('public.labs') IS NULL
         AND to_regclass('public.test_cases') IS NULL
         AND to_regclass('public.secrets') IS NULL
        THEN 1
        ELSE 0
    END AS run_init
\gset

\if :run_init
\echo [setupDB_Master] Fresh database detected; running setupDB_Init.sql
\ir setupDB_Init.sql
\else
\echo [setupDB_Master] Existing database detected; skipping setupDB_Init.sql and applying idempotent migrations

-- Existing DB safety: verify required core tables are present before applying dependent scripts.
DO $$
BEGIN
    IF to_regclass('public.users') IS NULL
       OR to_regclass('public.labs') IS NULL
       OR to_regclass('public.test_cases') IS NULL
       OR to_regclass('public.secrets') IS NULL THEN
        RAISE EXCEPTION
            'Existing DB is missing one or more core init tables (users, labs, test_cases, secrets). Run setupDB_Init.sql first on this DB.';
    END IF;
END $$;
\endif

-- Run all remaining setup scripts in established dependency order.
\ir setupDB_RISCV_LoadStore_Syntax.sql
\ir setupDB_Persistence.sql
\ir setupDB_UserSettings.sql
\ir setupDB_Courses.sql
\ir setupDB_GradeAttempts.sql
\ir setupDB_CourseGradeAttempts.sql
\ir setupDB_ASUID.sql
\ir setupDB_TARoles.sql

\echo [setupDB_Master] Complete
