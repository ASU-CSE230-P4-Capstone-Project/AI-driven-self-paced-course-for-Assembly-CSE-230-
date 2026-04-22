-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Courses
CREATE TABLE public.courses (
    course_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_code character varying(20) NOT NULL,
    course_name character varying(255) NOT NULL,
    description text,
    semester character varying(20) NOT NULL,
    year integer NOT NULL,
    is_active boolean DEFAULT true,
    CONSTRAINT courses_pkey PRIMARY KEY (course_id)
);

-- Users
CREATE TABLE public.users (
    user_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(255),
    asu_id character varying(20),
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp with time zone,
    is_active boolean DEFAULT true,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_email_key UNIQUE (email)
);

-- Labs
CREATE TABLE public.labs (
    lab_id character varying(50) NOT NULL,
    course_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    instructions text NOT NULL,
    starter_code text,
    solution_code text,
    register_mapping jsonb DEFAULT '{}'::jsonb,
    initial_values jsonb DEFAULT '{}'::jsonb,
    max_memory_kb integer DEFAULT 1024,
    time_limit_seconds integer DEFAULT 10,
    max_instructions integer DEFAULT 10000,
    total_points integer DEFAULT 100,
    release_date timestamp with time zone,
    due_date timestamp with time zone,
    is_published boolean DEFAULT false,
    difficulty character varying(20) DEFAULT 'intermediate',
    use_isolation boolean DEFAULT false,
    CONSTRAINT labs_pkey PRIMARY KEY (lab_id),
    CONSTRAINT labs_course_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id)
);

-- Lab test cases
CREATE TABLE public.lab_test_cases (
    test_case_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lab_id character varying(50) NOT NULL,
    test_name character varying(255) NOT NULL,
    test_type character varying(20) NOT NULL,
    description text,
    input_data jsonb DEFAULT '{}'::jsonb,
    expected_output jsonb NOT NULL,
    points integer DEFAULT 10,
    is_hidden boolean DEFAULT false,
    timeout_seconds integer DEFAULT 5,
    CONSTRAINT lab_test_cases_pkey PRIMARY KEY (test_case_id),
    CONSTRAINT lab_test_cases_lab_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id)
);

-- Submissions (timing columns used by autograder + student detail page)
CREATE TABLE public.submissions (
    submission_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    asurite_id character varying(50),
    lab_id character varying(50) NOT NULL,
    score integer NOT NULL,
    total_possible integer NOT NULL,
    source_code text NOT NULL,
    test_results jsonb,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    duration_seconds integer,
    run_count integer DEFAULT 0,
    started_at timestamp with time zone,
    timing_flagged boolean DEFAULT false,
    CONSTRAINT submissions_pkey PRIMARY KEY (submission_id),
    CONSTRAINT submissions_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
    CONSTRAINT submissions_lab_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(lab_id)
);

CREATE TABLE public.score_overrides (
    override_id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(user_id),
    lab_id character varying(50) NOT NULL REFERENCES public.labs(lab_id),
    override_score numeric(6,2) NOT NULL,
    note text,
    created_by uuid REFERENCES public.users(user_id),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, lab_id)
);

-- Enrollments
CREATE TABLE public.enrollments (
    enrollment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    enrolled_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    dropped_at timestamp with time zone,
    CONSTRAINT enrollments_pkey PRIMARY KEY (enrollment_id),
    CONSTRAINT enrollments_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
    CONSTRAINT enrollments_course_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id)
);

-- User preferences
CREATE TABLE public.user_preferences (
    preference_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    theme character varying(20) DEFAULT 'light',
    editor_font_size integer DEFAULT 14,
    auto_save_enabled boolean DEFAULT true,
    additional_preferences jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT user_preferences_pkey PRIMARY KEY (preference_id),
    CONSTRAINT user_preferences_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- User sessions
CREATE TABLE public.user_sessions (
    session_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    ip_address inet,
    user_agent text,
    CONSTRAINT user_sessions_pkey PRIMARY KEY (session_id),
    CONSTRAINT user_sessions_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- Course roster (instructor-uploaded student whitelist for signup validation)
CREATE TABLE public.course_roster (
    roster_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    asurite character varying(50) NOT NULL,
    asu_id character varying(20),
    full_name character varying(255),
    email character varying(255),
    added_by uuid,
    added_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_registered boolean DEFAULT false,
    CONSTRAINT course_roster_pkey PRIMARY KEY (roster_id),
    CONSTRAINT course_roster_course_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id),
    CONSTRAINT course_roster_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id),
    CONSTRAINT course_roster_asurite_course_uq UNIQUE (asurite, course_id)
);

CREATE TABLE public.run_telemetry (
    telemetry_id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(user_id),
    lab_id character varying(50) NOT NULL REFERENCES public.labs(lab_id),
    source_code text NOT NULL,
    executed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_step boolean DEFAULT false
);