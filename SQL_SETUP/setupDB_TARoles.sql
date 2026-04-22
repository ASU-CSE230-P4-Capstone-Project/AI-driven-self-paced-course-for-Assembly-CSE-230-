-- TA role + TA section enrollment support

-- Run this sixth

-- Ensure role enum exists and includes 'ta'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'course_role'
    ) THEN
        CREATE TYPE public.course_role AS ENUM ('student', 'instructor', 'ta');
    ELSIF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'course_role'
          AND e.enumlabel = 'ta'
    ) THEN
        ALTER TYPE public.course_role ADD VALUE 'ta';
    END IF;
END $$;

-- Ensure course_memberships.role uses course_role enum
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'course_memberships'
          AND column_name = 'role'
          AND udt_name <> 'course_role'
    ) THEN
        ALTER TABLE public.course_memberships
            ALTER COLUMN role TYPE public.course_role
            USING role::public.course_role;
    END IF;
END $$;

-- Ensure users has ASU ID for all account types (student, instructor, TA)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS asuid text;

-- Backfill missing ASU IDs for existing rows, then enforce constraints.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.users
        WHERE asuid IS NULL OR btrim(asuid) = '' OR asuid !~ '^[0-9]{10}$'
    ) THEN
        WITH current_max AS (
            SELECT
                COALESCE(MAX(asuid::bigint), 8999999999::bigint) AS max_asuid
            FROM public.users
            WHERE asuid ~ '^[0-9]{10}$'
        ),
        generated AS (
            SELECT
                username,
                (current_max.max_asuid + row_number() OVER (ORDER BY username))::text AS generated_asuid
            FROM public.users, current_max
            WHERE asuid IS NULL OR btrim(asuid) = '' OR asuid !~ '^[0-9]{10}$'
        )
        UPDATE public.users u
        SET asuid = g.generated_asuid
        FROM generated g
        WHERE u.username = g.username
          AND (u.asuid IS NULL OR btrim(u.asuid) = '' OR u.asuid !~ '^[0-9]{10}$');
    END IF;
END $$;

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_asuid_key'
    ) THEN
        ALTER TABLE ONLY public.users
            ADD CONSTRAINT users_asuid_key UNIQUE (asuid);
    END IF;
END $$;

ALTER TABLE public.users
    ALTER COLUMN asuid SET NOT NULL;

-- TA profile data (normal user-style fields for TA metadata)
CREATE TABLE IF NOT EXISTS public.ta_profiles (
    username text NOT NULL,
    first_name text,
    last_name text,
    email text,
    phone text,
    office_location text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ta_profiles OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ta_profiles_pkey'
    ) THEN
        ALTER TABLE ONLY public.ta_profiles
            ADD CONSTRAINT ta_profiles_pkey PRIMARY KEY (username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ta_profiles_user_fkey'
    ) THEN
        ALTER TABLE ONLY public.ta_profiles
            ADD CONSTRAINT ta_profiles_user_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

-- Course sections for TA assignments
CREATE TABLE IF NOT EXISTS public.course_sections (
    section_id bigserial NOT NULL,
    course_id char(5) NOT NULL,
    section_code text NOT NULL,
    section_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_sections OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_sections_pkey'
    ) THEN
        ALTER TABLE ONLY public.course_sections
            ADD CONSTRAINT course_sections_pkey PRIMARY KEY (section_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_sections_course_code_key'
    ) THEN
        ALTER TABLE ONLY public.course_sections
            ADD CONSTRAINT course_sections_course_code_key UNIQUE (course_id, section_code);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_sections_course_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_sections
            ADD CONSTRAINT course_sections_course_fkey
            FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_sections_course_idx
    ON public.course_sections (course_id);

-- One TA can be enrolled in one or more sections
CREATE TABLE IF NOT EXISTS public.ta_section_enrollments (
    section_id bigint NOT NULL,
    ta_username text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    added_by text,
    added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ta_section_enrollments OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ta_section_enrollments_pkey'
    ) THEN
        ALTER TABLE ONLY public.ta_section_enrollments
            ADD CONSTRAINT ta_section_enrollments_pkey PRIMARY KEY (section_id, ta_username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ta_section_enrollments_section_fkey'
    ) THEN
        ALTER TABLE ONLY public.ta_section_enrollments
            ADD CONSTRAINT ta_section_enrollments_section_fkey
            FOREIGN KEY (section_id) REFERENCES public.course_sections(section_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ta_section_enrollments_ta_fkey'
    ) THEN
        ALTER TABLE ONLY public.ta_section_enrollments
            ADD CONSTRAINT ta_section_enrollments_ta_fkey
            FOREIGN KEY (ta_username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ta_section_enrollments_added_by_fkey'
    ) THEN
        ALTER TABLE ONLY public.ta_section_enrollments
            ADD CONSTRAINT ta_section_enrollments_added_by_fkey
            FOREIGN KEY (added_by) REFERENCES public.users(username) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ta_section_enrollments_ta_idx
    ON public.ta_section_enrollments (ta_username);

CREATE INDEX IF NOT EXISTS ta_section_enrollments_section_idx
    ON public.ta_section_enrollments (section_id);

-- Enforce that section enrollment rows only reference users with TA role
CREATE OR REPLACE FUNCTION public.validate_ta_section_enrollment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    section_course_id char(5);
BEGIN
    SELECT cs.course_id
    INTO section_course_id
    FROM public.course_sections cs
    WHERE cs.section_id = NEW.section_id;

    IF section_course_id IS NULL THEN
        RAISE EXCEPTION 'Section % does not exist', NEW.section_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.course_memberships cm
        WHERE cm.course_id = section_course_id
          AND cm.username = NEW.ta_username
          AND cm.role = 'ta'::public.course_role
          AND cm.status = 'active'
    ) THEN
        RAISE EXCEPTION
            'User % must be an active TA in course % before section assignment',
            NEW.ta_username,
            section_course_id;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'ta_section_enrollments_validate_ta_role_trg'
          AND tgrelid = 'public.ta_section_enrollments'::regclass
    ) THEN
        CREATE TRIGGER ta_section_enrollments_validate_ta_role_trg
        BEFORE INSERT OR UPDATE
        ON public.ta_section_enrollments
        FOR EACH ROW
        EXECUTE FUNCTION public.validate_ta_section_enrollment();
    END IF;
END $$;

-- Helper: assign (or re-activate) a TA to a section
CREATE OR REPLACE FUNCTION public.assign_ta_to_section(
    p_section_id bigint,
    p_ta_username text,
    p_added_by text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.ta_section_enrollments (section_id, ta_username, status, added_by, added_at)
    VALUES (p_section_id, p_ta_username, 'active', p_added_by, now())
    ON CONFLICT (section_id, ta_username)
    DO UPDATE SET
        status = 'active',
        added_by = EXCLUDED.added_by,
        added_at = now();
END;
$$;

-- Helper: remove a TA from one section
CREATE OR REPLACE FUNCTION public.unassign_ta_from_section(
    p_section_id bigint,
    p_ta_username text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    removed_count integer;
BEGIN
    DELETE FROM public.ta_section_enrollments
    WHERE section_id = p_section_id
      AND ta_username = p_ta_username;

    GET DIAGNOSTICS removed_count = ROW_COUNT;
    RETURN removed_count;
END;
$$;

-- Helper: remove a TA from all sections
CREATE OR REPLACE FUNCTION public.unassign_ta_from_all_sections(
    p_ta_username text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    removed_count integer;
BEGIN
    DELETE FROM public.ta_section_enrollments
    WHERE ta_username = p_ta_username;

    GET DIAGNOSTICS removed_count = ROW_COUNT;
    RETURN removed_count;
END;
$$;
