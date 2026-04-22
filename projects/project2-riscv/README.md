# Project 2 — Web RISC-V (RV32I) Emulator with Course Integrations

A web-based RISC-V learning and grading application with a Next.js frontend, a Flask backend, and a PostgreSQL database.

## Easy Guide to Setup and Installation

Follow [SETUP_AND_RUNNING.md](./handoff-docs/SETUP_AND_RUNNING.md) to configure the database, backend, frontend, and general installation/setup information

## Detailed Documentation:

Useful detailed docs:

- [Handoff Docs Index](./handoff-docs/README.md)
- [Setup And Running](./handoff-docs/SETUP_AND_RUNNING.md)
- [Local To Hosted Deployment](./handoff-docs/LOCAL_TO_HOSTED_DEPLOYMENT.md)
- [Frontend README](./handoff-docs/FRONTEND_README.md)
- [Backend README](./handoff-docs/BACKEND_README.md)
- [Database Setup Instructions](./handoff-docs/Database_Setup_instructions.md)

## Overview

The repository has three main application areas:

- `riscv/`, Next.js frontend, auth pages, student, instructor, and TA views, simulator UI, and Next API routes.
- `prototype_interp/`, Flask backend, RISC V parsing, execution, simulator responses, and grading endpoints.
- `SQL_SETUP/` and `db-seeds/`, PostgreSQL schema setup and lab seed data.

## Intended Use

This project is meant for teaching and evaluating introductory RISC V assembly. Students write and run code in the browser, instructors and TAs manage courses and labs, and the system stores coursework, grading data, and submissions in PostgreSQL.

## Quick Start

1. Install Node.js `23.5.0`, or use the repo `.nvmrc` with `fnm use`.
2. Install `uv` for Python dependency management.
3. Set up PostgreSQL, then apply schema and optional seeds.
4. Install frontend and backend dependencies.
5. Run the backend and frontend in separate terminals.

Frontend install:

```bash
cd riscv
npm ci
```

Backend install:

```bash
cd prototype_interp
uv sync
```

Backend run:

```bash
cd prototype_interp
uv run python server.py
```

Frontend run:

```bash
cd riscv
npm run dev
```

Local URLs:

- Frontend, `http://localhost:3000`
- Backend, `http://localhost:25565`

## Runtime And Versions

- Frontend runtime, Node.js `23.5.0`, pinned in `.nvmrc`
- Backend runtime, Python `3.12` or newer, from `prototype_interp/pyproject.toml`
- Frontend framework, Next.js `15.5.14` with React `19.1.0`
- Backend framework, Flask `3.1.2` or newer
- Database, PostgreSQL

Use `riscv/package-lock.json` and `prototype_interp/uv.lock` to replicate the dependency setup used by this repo.

## User Guide

- Students register or log in, open labs or projects, write RISC V assembly, run the simulator, and submit lab work for grading when assigned through a course.
- Instructors create labs, test cases, and courses, assign labs to courses, and review submissions and grades.
- TAs use the staff views and simulator sandbox to support course operations and review student work.
- For full local setup, hosting, and database instructions, use the linked docs in `handoff-docs`.

## Repository Layout

- `riscv/`, active frontend package and application code.
- `prototype_interp/`, Python backend and emulator code.
- `SQL_SETUP/`, database setup and migration style SQL.
- `db-seeds/`, standalone lab seed files.
- `handoff-docs/`, in depth onboarding and maintenance documentation.

## Notes

- The active frontend package is in `riscv/package.json`.
- Use `SQL_SETUP/setupDB_Master.sql` as the main schema setup entry point.
- Use `db-seeds/` after schema setup if you want starter lab content.
- Do not commit real `.env` files or database credentials.
