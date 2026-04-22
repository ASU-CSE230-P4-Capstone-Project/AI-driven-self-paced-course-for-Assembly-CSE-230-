-- Grade attempt tracking (per student, per lab)
-- Run this FOURTH, AFTER setupDB_Init.sql (requires users and labs)

CREATE TABLE IF NOT EXISTS public.grade_attempts (
    username text NOT NULL,
    lab_uid text NOT NULL,
    attempts_used integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_attempts OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grade_attempts_pkey'
    ) THEN
        ALTER TABLE ONLY public.grade_attempts
            ADD CONSTRAINT grade_attempts_pkey PRIMARY KEY (username, lab_uid);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grade_attempts_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.grade_attempts
            ADD CONSTRAINT grade_attempts_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grade_attempts_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.grade_attempts
            ADD CONSTRAINT grade_attempts_lab_fkey
            FOREIGN KEY (lab_uid) REFERENCES public.labs(uid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.grade_attempt_sessions (
    username text NOT NULL,
    lab_uid text NOT NULL,
    grade_session_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_attempt_sessions OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grade_attempt_sessions_pkey'
    ) THEN
        ALTER TABLE ONLY public.grade_attempt_sessions
            ADD CONSTRAINT grade_attempt_sessions_pkey PRIMARY KEY (username, lab_uid, grade_session_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grade_attempt_sessions_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.grade_attempt_sessions
            ADD CONSTRAINT grade_attempt_sessions_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grade_attempt_sessions_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.grade_attempt_sessions
            ADD CONSTRAINT grade_attempt_sessions_lab_fkey
            FOREIGN KEY (lab_uid) REFERENCES public.labs(uid) ON DELETE CASCADE;
    END IF;
END $$;
