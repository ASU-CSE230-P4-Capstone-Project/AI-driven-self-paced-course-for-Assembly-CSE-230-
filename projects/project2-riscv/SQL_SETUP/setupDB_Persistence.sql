-- Workspace and lab session persistence tables

-- INSERT "INIT" FIRST, RUN THIS SECOND

CREATE TABLE IF NOT EXISTS public.workspaces (
    username text NOT NULL,
    uid text NOT NULL,
    current_project_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_pkey'
    ) THEN
        ALTER TABLE ONLY public.workspaces
            ADD CONSTRAINT workspaces_pkey PRIMARY KEY (username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.workspaces
            ADD CONSTRAINT workspaces_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_projects (
    id text NOT NULL,
    workspace_username text NOT NULL,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    code text NOT NULL DEFAULT '',
    resp jsonb,
    sim_state jsonb,
    step_index integer NOT NULL DEFAULT 0,
    all_states jsonb NOT NULL DEFAULT '[]'::jsonb,
    register_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.workspace_projects OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspace_projects_pkey'
    ) THEN
        ALTER TABLE ONLY public.workspace_projects
            ADD CONSTRAINT workspace_projects_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspace_projects_workspace_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.workspace_projects
            ADD CONSTRAINT workspace_projects_workspace_username_fkey
            FOREIGN KEY (workspace_username) REFERENCES public.workspaces(username) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS workspace_projects_workspace_username_idx
    ON public.workspace_projects (workspace_username);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_current_project_fkey'
    ) THEN
        ALTER TABLE ONLY public.workspaces
            ADD CONSTRAINT workspaces_current_project_fkey
            FOREIGN KEY (current_project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lab_sessions (
    username text NOT NULL,
    storage_key text NOT NULL,
    uid text NOT NULL,
    lab_uid text,
    version integer NOT NULL DEFAULT 1,
    code text NOT NULL DEFAULT '',
    resp jsonb,
    sim_state jsonb,
    step_index integer NOT NULL DEFAULT 0,
    all_states jsonb NOT NULL DEFAULT '[]'::jsonb,
    register_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_sessions OWNER TO capstone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_sessions_pkey'
    ) THEN
        ALTER TABLE ONLY public.lab_sessions
            ADD CONSTRAINT lab_sessions_pkey PRIMARY KEY (username, storage_key);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_sessions_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.lab_sessions
            ADD CONSTRAINT lab_sessions_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lab_sessions_lab_uid_fkey'
    ) THEN
        ALTER TABLE ONLY public.lab_sessions
            ADD CONSTRAINT lab_sessions_lab_uid_fkey
            FOREIGN KEY (lab_uid) REFERENCES public.labs(uid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS lab_sessions_username_idx
    ON public.lab_sessions (username);

-- ===== Human-Readable Schema Summary (Persistence) =====
-- workspaces
--   username (PK, FK -> users.username), uid, current_project_id (FK -> workspace_projects.id)
--
-- workspace_projects
--   id (PK), workspace_username (FK -> workspaces.username), name, description,
--   created_at, updated_at, code, resp, sim_state, step_index, all_states, register_overrides
--
-- lab_sessions
--   (username, storage_key) (PK),
--   lab_uid (FK -> labs.uid), uid, version, code, resp, sim_state, step_index,
--   all_states, register_overrides, created_at, updated_at
--
-- Relationships
--   workspaces.username -> users.username
--   workspace_projects.workspace_username -> workspaces.username
--   workspaces.current_project_id -> workspace_projects.id (ON DELETE SET NULL)
--   lab_sessions.username -> users.username
--   lab_sessions.lab_uid -> labs.uid
