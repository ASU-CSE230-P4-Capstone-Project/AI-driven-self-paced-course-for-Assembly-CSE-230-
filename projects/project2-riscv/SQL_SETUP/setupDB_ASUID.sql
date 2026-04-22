-- ASU ID migration for existing databases
-- Run this AFTER setupDB_Init.sql (users table must already exist)

-- RUN THIS FIFTH
-- Add ASU ID column if missing.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS asuid text;

-- Backfill/fix ASU IDs:
-- - NULL/blank/non-10-digit values are replaced
-- - duplicate ASU IDs (beyond the first row) are replaced
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.users
        WHERE asuid IS NULL
           OR btrim(asuid) = ''
           OR asuid !~ '^[0-9]{10}$'
    )
    OR EXISTS (
        SELECT 1
        FROM (
            SELECT asuid
            FROM public.users
            WHERE asuid ~ '^[0-9]{10}$'
            GROUP BY asuid
            HAVING COUNT(*) > 1
        ) dupes
    ) THEN
        WITH valid_existing AS (
            SELECT
                username,
                asuid,
                row_number() OVER (PARTITION BY asuid ORDER BY username) AS duplicate_rank
            FROM public.users
            WHERE asuid ~ '^[0-9]{10}$'
        ),
        rows_needing_fix AS (
            SELECT u.username
            FROM public.users u
            LEFT JOIN valid_existing v ON v.username = u.username
            WHERE u.asuid IS NULL
               OR btrim(u.asuid) = ''
               OR u.asuid !~ '^[0-9]{10}$'
               OR v.duplicate_rank > 1
        ),
        current_max AS (
            SELECT
                COALESCE(MAX(asuid::bigint), 8999999999::bigint) AS max_asuid
            FROM public.users
            WHERE asuid ~ '^[0-9]{10}$'
        ),
        generated AS (
            SELECT
                r.username,
                (current_max.max_asuid + row_number() OVER (ORDER BY r.username))::text AS generated_asuid
            FROM rows_needing_fix r, current_max
        )
        UPDATE public.users u
        SET asuid = g.generated_asuid
        FROM generated g
        WHERE u.username = g.username;
    END IF;
END $$;

-- Enforce 10-digit ASU ID format.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_asuid_format_check'
    ) THEN
        ALTER TABLE ONLY public.users
            ADD CONSTRAINT users_asuid_format_check
            CHECK (asuid ~ '^[0-9]{10}$');
    END IF;
END $$;

-- Enforce uniqueness.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_asuid_key'
    ) THEN
        ALTER TABLE ONLY public.users
            ADD CONSTRAINT users_asuid_key UNIQUE (asuid);
    END IF;
END $$;

-- Final non-null requirement.
ALTER TABLE public.users
    ALTER COLUMN asuid SET NOT NULL;

