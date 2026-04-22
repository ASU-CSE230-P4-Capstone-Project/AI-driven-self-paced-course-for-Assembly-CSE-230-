-- Per-user UI preferences
-- Run this AFTER setupDB_Init.sql (requires users)

CREATE TABLE IF NOT EXISTS public.user_settings (
    username text NOT NULL,
    editor_font_size integer NOT NULL DEFAULT 14,
    show_help_bubble boolean NOT NULL DEFAULT true,
    open_instructions_by_default boolean NOT NULL DEFAULT true,
    warn_before_reinstate boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_settings_editor_font_size_check CHECK (editor_font_size BETWEEN 12 AND 24)
);

ALTER TABLE public.user_settings OWNER TO CURRENT_USER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_pkey'
    ) THEN
        ALTER TABLE ONLY public.user_settings
            ADD CONSTRAINT user_settings_pkey PRIMARY KEY (username);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_username_fkey'
    ) THEN
        ALTER TABLE ONLY public.user_settings
            ADD CONSTRAINT user_settings_username_fkey
            FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;
    END IF;
END $$;

-- ===== Human-Readable Schema Summary (User Settings) =====
-- user_settings
--   username (PK, FK -> users.username),
--   editor_font_size, show_help_bubble, open_instructions_by_default,
--   warn_before_reinstate, created_at, updated_at
