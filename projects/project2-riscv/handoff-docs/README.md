# Capstone2 Handoff Docs

This folder is the handoff bundle for the Capstone2 RISC-V learning app. It is meant for a new working group that needs to understand the repo quickly, run it locally, and know where to make future changes.

## What This Repo Contains

The app has three main parts:

- `riscv/`: Next.js frontend. It owns login/register pages, student/instructor/TA screens, the code editor UI, Next API routes, and database access used by the web app.
- `prototype_interp/`: Python Flask backend. It parses and runs RISC-V assembly, returns machine states for the simulator, and handles grading endpoints that execute code against test cases.
- `SQL_SETUP/` and `db-seeds/`: PostgreSQL schema setup and seed data for labs/test cases.

Generated folders such as `riscv/.next`, `riscv/.next-dev`, `riscv/node_modules`, `prototype_interp/.venv`, and `prototype_interp/__pycache__` are not source folders.

## Easy Guide to Setup and Installation

Follow [SETUP_AND_RUNNING.md](./SETUP_AND_RUNNING.md) to configure the database, backend, frontend, and general installation/setup information


## Quick Overview: Local Architecture

In local development:

- The Python backend runs on `http://localhost:25565`.
- The Next.js frontend normally runs on `http://localhost:3000`.
- Frontend routes under `riscv/app/api/run`, `riscv/app/api/score`, `riscv/app/api/grade_lab`, and `riscv/app/api/grade_status` proxy simulator/grading calls to the Flask backend.
- Frontend API routes that need app data connect directly to PostgreSQL through `riscv/app/sql/sql.tsx`.
- The backend also connects to PostgreSQL for grading/test-case lookups.


## Detailed Information Starts Here

1. Read [REPO_MAP.md](./REPO_MAP.md) for the folder map.
2. Read [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) for the system overview and request flow diagrams.
3. Use [FRONTEND_README.md](./FRONTEND_README.md) when working in `riscv/`.
4. Use [BACKEND_README.md](./BACKEND_README.md) when working in `prototype_interp/`.
5. Use [SQL_README.md](./SQL_README.md) before changing schema, seeds, labs, courses, attempts, or submissions.
6. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) when local setup fails.
7. Use [LOCAL_TO_HOSTED_DEPLOYMENT.md](./LOCAL_TO_HOSTED_DEPLOYMENT.md) when moving a working local setup into hosted deployment.


## Important Rules

- Do not commit real `.env` files or database credentials.
- Prefer `SQL_SETUP/setupDB_Master.sql` for schema setup on a fresh or existing database.
- Use `db-seeds/` for the newer standalone lab seeds.
- Keep docs updates separate from app/backend behavior changes when possible.
