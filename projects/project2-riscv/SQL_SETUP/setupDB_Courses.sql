-- Course + enrollment + lab mapping + future grading tables

-- DO this THIRD. After INIT and PERSISTENCE are setup

CREATE TABLE IF NOT EXISTS public.courses (
    course_id char(5) NOT NULL CHECK (course_id ~ '^[0-9]{5}$'),
    code text NOT NULL,
    title text NOT NULL,
    term text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courses OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'courses_pkey'
    ) THEN
        ALTER TABLE ONLY public.courses
            ADD CONSTRAINT courses_pkey PRIMARY KEY (course_id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS courses_code_term_idx
    ON public.courses (code, term);

CREATE TABLE IF NOT EXISTS public.course_memberships (
    course_id char(5) NOT NULL,
    username text NOT NULL,
    role text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    added_by text,
    added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_memberships OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_memberships_pkey'
    ) THEN
        ALTER TABLE ONLY public.course_memberships
            ADD CONSTRAINT course_memberships_pkey PRIMARY KEY (course_id, username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_memberships_course_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_memberships
            ADD CONSTRAINT course_memberships_course_fkey
            FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_memberships_user_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_memberships
            ADD CONSTRAINT course_memberships_user_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_memberships_added_by_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_memberships
            ADD CONSTRAINT course_memberships_added_by_fkey
            FOREIGN KEY (added_by) REFERENCES public.users(username) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_memberships_user_idx
    ON public.course_memberships (username);

CREATE TABLE IF NOT EXISTS public.course_labs (
    course_id char(5) NOT NULL,
    lab_uid text NOT NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    position integer NOT NULL DEFAULT 0
);

ALTER TABLE public.course_labs OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_labs_pkey'
    ) THEN
        ALTER TABLE ONLY public.course_labs
            ADD CONSTRAINT course_labs_pkey PRIMARY KEY (course_id, lab_uid);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_labs_course_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_labs
            ADD CONSTRAINT course_labs_course_fkey
            FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_labs_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.course_labs
            ADD CONSTRAINT course_labs_lab_fkey
            FOREIGN KEY (lab_uid) REFERENCES public.labs(uid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_labs_lab_idx
    ON public.course_labs (lab_uid);

CREATE TABLE IF NOT EXISTS public.lab_grades (
    course_id char(5) NOT NULL,
    lab_uid text NOT NULL,
    student_username text NOT NULL,
    score numeric,
    max_score numeric,
    attempt_number integer NOT NULL DEFAULT 1,
    graded_at timestamptz NOT NULL DEFAULT now(),
    grader_username text
);

ALTER TABLE public.lab_grades OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_grades_pkey'
    ) THEN
        ALTER TABLE ONLY public.lab_grades
            ADD CONSTRAINT lab_grades_pkey PRIMARY KEY (course_id, lab_uid, student_username, attempt_number);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_grades_course_fkey'
    ) THEN
        ALTER TABLE ONLY public.lab_grades
            ADD CONSTRAINT lab_grades_course_fkey
            FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_grades_lab_fkey'
    ) THEN
        ALTER TABLE ONLY public.lab_grades
            ADD CONSTRAINT lab_grades_lab_fkey
            FOREIGN KEY (lab_uid) REFERENCES public.labs(uid) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_grades_student_fkey'
    ) THEN
        ALTER TABLE ONLY public.lab_grades
            ADD CONSTRAINT lab_grades_student_fkey
            FOREIGN KEY (student_username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_grades_grader_fkey'
    ) THEN
        ALTER TABLE ONLY public.lab_grades
            ADD CONSTRAINT lab_grades_grader_fkey
            FOREIGN KEY (grader_username) REFERENCES public.users(username) ON DELETE SET NULL;
    END IF;
END $$;

-- ===== Human-Readable Schema Summary (Courses) =====
-- courses
--   course_id (char(5) PK, 5-digit), code, title, term, created_at, updated_at
--
-- course_memberships
--   (course_id, username) (PK),
--   role ('student' | 'instructor' | 'ta'), status, added_by, added_at
--
-- course_labs
--   (course_id, lab_uid) (PK),
--   assigned_at, position
--
-- lab_grades
--   (course_id, lab_uid, student_username, attempt_number) (PK),
--   score, max_score, graded_at, grader_username
--
-- Relationships
--   course_memberships.course_id -> courses.course_id
--   course_memberships.username -> users.username
--   course_memberships.added_by -> users.username
--   course_labs.course_id -> courses.course_id
--   course_labs.lab_uid -> labs.uid
--   lab_grades.course_id -> courses.course_id
--   lab_grades.lab_uid -> labs.uid
--   lab_grades.student_username -> users.username
--   lab_grades.grader_username -> users.username
