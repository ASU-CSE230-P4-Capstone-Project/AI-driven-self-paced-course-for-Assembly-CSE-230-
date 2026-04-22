-- Course-scoped grade attempt tracking (per student, per course, per lab)
-- Run this AFTER setupDB_Courses.sql (requires users and course_labs)

CREATE TABLE IF NOT EXISTS public.course_grade_attempts (
    username text NOT NULL,
    course_id char(5) NOT NULL,
    lab_uid text NOT NULL,
    attempts_used integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_grade_attempts OWNER TO CURRENT_USER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_grade_attempts_pkey'
    ) THEN
        ALTER TABLE ONLY public.course_grade_attempts
            ADD CONSTRAINT course_grade_attempts_pkey PRIMARY KEY (username, course_id, lab_uid);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_grade_attempts_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_grade_attempts
            ADD CONSTRAINT course_grade_attempts_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_grade_attempts_course_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_grade_attempts
            ADD CONSTRAINT course_grade_attempts_course_lab_fkey
            FOREIGN KEY (course_id, lab_uid) REFERENCES public.course_labs(course_id, lab_uid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.course_grade_attempt_sessions (
    username text NOT NULL,
    course_id char(5) NOT NULL,
    lab_uid text NOT NULL,
    grade_session_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_grade_attempt_sessions OWNER TO CURRENT_USER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_grade_attempt_sessions_pkey'
    ) THEN
        ALTER TABLE ONLY public.course_grade_attempt_sessions
            ADD CONSTRAINT course_grade_attempt_sessions_pkey PRIMARY KEY (username, course_id, lab_uid, grade_session_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_grade_attempt_sessions_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_grade_attempt_sessions
            ADD CONSTRAINT course_grade_attempt_sessions_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_grade_attempt_sessions_course_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_grade_attempt_sessions
            ADD CONSTRAINT course_grade_attempt_sessions_course_lab_fkey
            FOREIGN KEY (course_id, lab_uid) REFERENCES public.course_labs(course_id, lab_uid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.course_lab_submissions (
    username text NOT NULL,
    course_id char(5) NOT NULL,
    lab_uid text NOT NULL,
    grade_session_id text NOT NULL,
    submitted_code text NOT NULL,
    grade numeric(5,2) NOT NULL,
    passed_tests integer NOT NULL DEFAULT 0,
    total_tests integer NOT NULL,
    passed boolean NOT NULL DEFAULT false,
    error_message text,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT course_lab_submissions_grade_check CHECK (grade >= 0 AND grade <= 100),
    CONSTRAINT course_lab_submissions_counts_check CHECK (passed_tests >= 0 AND total_tests > 0 AND passed_tests <= total_tests)
);

ALTER TABLE public.course_lab_submissions OWNER TO CURRENT_USER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_lab_submissions_pkey'
    ) THEN
        ALTER TABLE ONLY public.course_lab_submissions
            ADD CONSTRAINT course_lab_submissions_pkey PRIMARY KEY (username, course_id, lab_uid, grade_session_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_lab_submissions_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_lab_submissions
            ADD CONSTRAINT course_lab_submissions_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_lab_submissions_course_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_lab_submissions
            ADD CONSTRAINT course_lab_submissions_course_lab_fkey
            FOREIGN KEY (course_id, lab_uid) REFERENCES public.course_labs(course_id, lab_uid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_lab_submissions_lookup_idx
    ON public.course_lab_submissions (username, course_id, lab_uid, submitted_at DESC);

-- Optional seed labs for the course-aware student lab flow.
-- These are safe to re-run and only attach to demo courses if those courses exist.
INSERT INTO public.labs (uid, title, md)
VALUES
(
    'seed-course-shared-lab-20260319',
    'Seed Shared Course Lab',
    replace($seed_shared_lab_md$# Seed Shared Course Lab

This sample lab is assigned to more than one course so you can verify that
student progress and grading attempts stay isolated per course.

~~~
# Seed shared course lab
# Add 7 and 8, store the result in x3
addi x1, x0, 7
addi x2, x0, 8
add x3, x1, x2
~~~
$seed_shared_lab_md$, '\n', E'\n')
),
(
    'seed-course-exclusive-lab-20260319',
    'Seed Exclusive Course Lab',
    replace($seed_exclusive_lab_md$# Seed Exclusive Course Lab

This sample lab is assigned to a single seeded course so you can verify that
course-specific lab lists only show what belongs to the selected course.

~~~
# Seed exclusive course lab
# Count down from 3 to 0
addi x5, x0, 3
addi x6, x0, 0
addi x6, x6, 1
addi x5, x5, -1
bne x5, x0, -2
~~~
$seed_exclusive_lab_md$, '\n', E'\n')
)
ON CONFLICT (uid) DO UPDATE
SET title = EXCLUDED.title,
    md = EXCLUDED.md;

WITH seed_course_labs (course_id, lab_uid, position) AS (
    VALUES
        ('48501', '2025120316373801513aa03d83-8962-4322-a6f6-03aa9ffde273', 0),
        ('48501', 'seed-course-shared-lab-20260319', 1),
        ('48501', 'seed-course-exclusive-lab-20260319', 2),
        ('48502', '202512031635030656c5830d1a-8aef-45e4-b062-4b7c1c5531f4', 0),
        ('48502', 'seed-course-shared-lab-20260319', 1),
        ('31001', '2025120316373801513aa03d83-8962-4322-a6f6-03aa9ffde273', 0)
)
INSERT INTO public.course_labs (course_id, lab_uid, position)
SELECT
    scl.course_id::char(5),
    scl.lab_uid,
    scl.position
FROM seed_course_labs scl
JOIN public.courses c
    ON c.course_id = scl.course_id::char(5)
JOIN public.labs l
    ON l.uid = scl.lab_uid
ON CONFLICT (course_id, lab_uid) DO UPDATE
SET position = EXCLUDED.position;

-- ===== Human-Readable Schema Summary (Course Grade Attempts) =====
-- course_grade_attempts
--   (username, course_id, lab_uid) (PK),
--   attempts_used, updated_at
--
-- course_grade_attempt_sessions
--   (username, course_id, lab_uid, grade_session_id) (PK),
--   created_at
--
-- course_lab_submissions
--   (username, course_id, lab_uid, grade_session_id) (PK),
--   submitted_code, grade, passed_tests, total_tests, passed, error_message, submitted_at
--
-- Relationships
--   course_grade_attempts.username -> users.username
--   course_grade_attempts.(course_id, lab_uid) -> course_labs.(course_id, lab_uid)
--   course_grade_attempt_sessions.username -> users.username
--   course_grade_attempt_sessions.(course_id, lab_uid) -> course_labs.(course_id, lab_uid)
--   course_lab_submissions.username -> users.username
--   course_lab_submissions.(course_id, lab_uid) -> course_labs.(course_id, lab_uid)
