# Local PostgreSQL Setup

These instructions are written for macOS, but the same PostgreSQL commands work on Windows as long as `psql` is installed and your local server is running.

## 1. Start PostgreSQL

Open PostgreSQL.app, pgAdmin, or whatever local PostgreSQL service you use and make sure:

- PostgreSQL is running
- it is listening on port `5432`
- you can connect as the `postgres` superuser


## 2. Create The Local Role And Database

Open a terminal and run this whole block:

```bash
psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'capstone') THEN
    CREATE ROLE capstone WITH LOGIN PASSWORD 'capstone';
  END IF;
END $$;

DROP DATABASE IF EXISTS capstone;
CREATE DATABASE capstone OWNER capstone;
SQL
```

This creates:

- a local PostgreSQL role named `capstone`
- a local database named `capstone`

## 3. Fix Public Schema Ownership

Then run:

```bash
psql -U postgres -d capstone -v ON_ERROR_STOP=1 <<'SQL'
ALTER SCHEMA public OWNER TO capstone;
GRANT ALL ON SCHEMA public TO capstone;
SQL
```

## 4. Apply The Current Schema

From the repo root, run:

```bash
psql -U capstone -d capstone -f SQL_SETUP/setupDB_Master.sql
```


`setupDB_Master.sql` is the correct script for this repo. On a fresh database it runs the core init setup, and on an existing database it applies the remaining idempotent setup scripts in dependency order.

## 5. Optional: Seed Starter Labs

If you want local starter lab content and test cases, also run:

```bash
psql -U capstone -d capstone -f db-seeds/seed_lab0_intro_addition.sql
psql -U capstone -d capstone -f db-seeds/seed_lab1_intro_subtraction.sql
psql -U capstone -d capstone -f db-seeds/seed_lab2_intro_bitwise_and.sql
```

These seed files add the starter labs used by the current app. After that, assign labs to courses in the instructor UI if needed.

## 6. Point The App At The Local Database

For fully local frontend + backend + database, use these env values.

`riscv/.env`:

```text
DATABASE_URL=postgresql://capstone:capstone@localhost:5432/capstone?sslmode=disable
BACKEND_URL=http://localhost:25565
```

`prototype_interp/.env`:

```text
DATABASE_URL=postgresql://capstone:capstone@localhost:5432/capstone?sslmode=disable
```


## 7. Run The App Locally

Backend:

```bash
cd prototype_interp
uv sync
uv run python server.py
```

Frontend:

```bash
cd riscv
npm ci
npm run dev
```

Expected local URLs:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:25565
Database: postgresql://capstone:capstone@localhost:5432/capstone
```

If you change env files while Next.js is already running, restart `npm run dev`.
