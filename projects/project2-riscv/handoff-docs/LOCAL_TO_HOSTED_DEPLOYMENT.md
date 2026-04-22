# Local To Hosted Deployment

This guide explains how to move this repository from a working local setup to a hosted one.

No code fork is required. The same repo supports both local and hosted use. The main differences are deployment targets, environment variables, and database/network access.

## Hosted Shape

In a hosted setup, this repo is still three pieces:

- `riscv/`, the Next.js frontend
- `prototype_interp/`, the Flask backend
- PostgreSQL, usually hosted separately

Important detail:

- the frontend host needs `DATABASE_URL` because Next API routes in `riscv/app/api` query PostgreSQL directly
- the backend host also needs `DATABASE_URL` because grading and test case lookup happen there
- the frontend host needs `BACKEND_URL` so its proxy routes can reach the hosted Flask backend

## What Changes From Local

When you move from local to hosted:

- replace local `DATABASE_URL` values with the hosted PostgreSQL connection string
- set `BACKEND_URL` in the hosted frontend environment to the public base URL of the hosted backend
- stop relying on the local fallback to `http://localhost:25565` for hosted frontend deployments
- let the backend host provide `PORT` if its platform requires that
- deploy the frontend as a real Next.js server app, not a static export

## Recommended Order

Deploy in this order:

1. provision the hosted PostgreSQL database
2. apply schema and optional seeds to that database
3. deploy the Flask backend
4. deploy the Next.js frontend

That order avoids booting the app against an empty or unreachable database.

## 1. Provision A Hosted PostgreSQL Database

Create a hosted PostgreSQL instance and get its connection string.

Typical hosted format:

```text
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Notes:

- many hosted providers require TLS, so `sslmode=require` is common
- if your provider gives you a full connection string already, use that exact value unless they document a different SSL option
- both the frontend host and backend host must be able to reach this database over the network

## 2. Apply Schema And Optional Seeds

From the repo root, apply the current schema to the hosted database:

```bash
psql "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require" -f SQL_SETUP/setupDB_Master.sql
```

If you want the starter labs and test cases, apply the standalone seed files after schema setup:

```bash
psql "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require" -f db-seeds/seed_lab0_intro_addition.sql
psql "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require" -f db-seeds/seed_lab1_intro_subtraction.sql
psql "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require" -f db-seeds/seed_lab2_intro_bitwise_and.sql
```

Use the same hosted database for:

- frontend `DATABASE_URL`
- backend `DATABASE_URL`
- any manual `psql` schema or seed commands

## 3. Set Hosted Environment Variables

Hosted frontend environment:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
BACKEND_URL=https://your-backend.example.com
```

Hosted backend environment:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Notes:

- `BACKEND_URL` must be the backend base URL only, not `/data` or another route
- if the hosted frontend leaves `BACKEND_URL` unset, empty, or whitespace only, it will fall back to `http://localhost:25565`, which is wrong for hosted use
- the backend already honors a host-provided `PORT` and defaults to `25565` only for local runs
- set host env variables in the hosting platform, not just in local `.env` files

## 4. Deploy The Backend

Deploy `prototype_interp/` as a Flask or Python web service.

Minimum backend requirements:

- install dependencies with `uv sync`
- run `server.py` as the service entry point
- expose the service publicly over HTTPS
- provide `DATABASE_URL`

The backend endpoints the frontend relies on are:

- `POST /data`
- `POST /score`
- `POST /grade_lab`
- `POST /grade_status`

Before deploying the frontend, confirm the backend is reachable at its public base URL.

## 5. Deploy The Frontend

Deploy `riscv/` as a Next.js app with server runtime support.

Minimum frontend requirements:

- install dependencies with `npm ci`
- build with `npm run build`
- provide `DATABASE_URL`
- provide `BACKEND_URL`

Important detail:

- this frontend is not just static HTML and client JavaScript
- it uses Next API routes and server-side database access
- the frontend host must be able to open outbound connections to PostgreSQL and to the hosted Flask backend

## 6. Verify The Hosted App

After both services are deployed, verify:

- login and registration work
- student, instructor, and TA pages load data without database connection errors
- simulator runs succeed from the editor
- grading requests succeed
- frontend logs do not show missing `DATABASE_URL`
- frontend proxy routes are hitting the hosted backend, not `localhost`

## Staged Migration Options

You do not have to move every piece at once.

Safe intermediate states:

- local frontend, local backend, hosted database
- local frontend, hosted backend, hosted database
- hosted frontend, hosted backend, hosted database

Risky or broken state:

- hosted frontend with a local backend, unless the local backend is exposed at a real public URL and `BACKEND_URL` points there

## Common Mistakes

- leaving hosted frontend `BACKEND_URL` unset and accidentally falling back to `http://localhost:25565`
- setting `BACKEND_URL` to `https://your-backend.example.com/data` instead of the backend base URL
- pointing frontend and backend at different databases
- deploying before `SQL_SETUP/setupDB_Master.sql` was applied
- expecting a static-only frontend host to work with Next API routes
- changing env values without restarting or redeploying the affected service

## Related Docs

- [SETUP_AND_RUNNING.md](./SETUP_AND_RUNNING.md)
- [Database_Setup_instructions.md](./Database_Setup_instructions.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
