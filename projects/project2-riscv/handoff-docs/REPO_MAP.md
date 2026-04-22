# Repo Map

This map focuses on source files and handoff-relevant folders. It intentionally skips generated and dependency folders.

## Root

- `README.md`: root overview and quick start.
- `LICENSE`: project license.
- `.nvmrc`: pinned Node.js version for the frontend toolchain.
- `gitinfo.md`: branch workflow note.
- `handoff-docs/`: new onboarding documentation bundle.

## `riscv/`

Next.js frontend.

- `app/`: App Router pages, layouts, and server API routes.
- `app/api/`: API route handlers for auth, labs, courses, grading proxies, workspace/session sync, settings, and reports.
- `app/sql/sql.tsx`: PostgreSQL connection pool for frontend/server routes.
- `app/verify/`: session verification and auth helpers.
- `components/`: shared React components and simulator UI.
- `components/root.tsx`: general project workspace.
- `components/lab_root.tsx`: student lab workspace.
- `components/staff-simulator.tsx`: instructor/TA sandbox.
- `components/use-runner.ts`: frontend run/start/step orchestration.
- `components/types.ts`: frontend/backend simulator request/response types.
- `public/`: static assets.
- `.env.example`: frontend env template.
- `package.json`: frontend scripts and dependencies.

Generated/dependency folders to ignore: `.next`, `.next-dev`, `node_modules`.

## `prototype_interp/`

Python Flask backend and emulator.

- `server.py`: Flask app, routes, DB connection, scoring/grading logic.
- `stringParse.py`: parser and lab-source preprocessing.
- `instructions.py`: RISC-V instruction implementations.
- `machine.py`: register/memory/PC state.
- `runtime.py`: execution loop.
- `test_*.py`: backend pytest files.
- `pyproject.toml`: backend dependencies and Python requirement.
- `uv.lock`: locked backend dependency graph.

Generated/dependency folders to ignore: `.venv`, `__pycache__`, `.pytest_cache`.

## `SQL_SETUP/`

Schema setup and migration-style SQL.

- `setupDB_Master.sql`: preferred setup entry point.
- `setupDB_Init.sql`: original core schema and older seed content.
- `setupDB_Persistence.sql`: workspace and lab session persistence.
- `setupDB_UserSettings.sql`: user settings table.
- `setupDB_Courses.sql`: courses, memberships, course labs, and older lab grades.
- `setupDB_GradeAttempts.sql`: older lab attempt tracking.
- `setupDB_CourseGradeAttempts.sql`: course-aware attempts and submission history.
- `setupDB_ASUID.sql`: ASU ID/user migration.
- `setupDB_TARoles.sql`: TA profile, course sections, and section enrollment helpers.
- `setupDB_RISCV_LoadStore_Syntax.sql`: seed lab syntax patch.

## `db-seeds/`

Seed SQL for starter content and legacy/dev data.

- `seed_data.sql`: legacy/dev seed bundle with sample users, courses, labs, and related records.
- `seed_lab0_intro_addition.sql`
- `seed_lab1_intro_subtraction.sql`
- `seed_lab2_intro_bitwise_and.sql`

Run these only after the schema exists. The standalone `seed_lab*.sql` files are the preferred starter lab seeds.
