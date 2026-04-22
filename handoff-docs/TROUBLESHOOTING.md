# Troubleshooting

## Frontend Cannot Connect To Database

Symptoms:

- Login/register/API calls fail.
- Error mentions missing `DATABASE_URL`.

Check:

- `riscv/.env` exists.
- It contains `DATABASE_URL`.
- The URL points to the same database where schema/seeds were applied.
- Hosted DB URLs usually need `sslmode=require`.

Relevant code: `riscv/app/sql/sql.tsx`.

## Simulator Run Fails

Symptoms:

- Running code from the editor returns backend connection errors.
- `/api/run`, `/api/score`, `/api/grade_lab`, or `/api/grade_status` fails.

Check that the backend is running:

```bash
cd prototype_interp
uv run python server.py
```

The backend should be listening on `http://localhost:25565` locally. The frontend proxy routes use `BACKEND_URL` when set, otherwise they default to `http://localhost:25565`.

For a hosted frontend, `localhost` points at the frontend host, not your laptop. Deploy the Flask backend separately and set `BACKEND_URL` in the frontend hosting environment, for example `https://your-backend.example.com`.

## Backend Cannot Connect To Database

Symptoms:

- `/score`, `/grade_lab`, or `/grade_status` fail.
- Error mentions missing `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, or `DB_PORT`.

Check `prototype_interp/.env`. Prefer:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

If no URL is set, provide all fallback DB variables.

## Schema Or Seed Errors

Use the master setup first:

```bash
psql "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require" -f SQL_SETUP/setupDB_Master.sql
```

Then run seeds from `db-seeds/`.

Common causes:

- Running seed files before schema setup.
- Using a different database URL for frontend, backend, and `psql`.
- Running an outdated or partial schema script and expecting the full app schema.
- Missing course assignment after seeding labs.

## Lint Fails On Generated `.next-dev`

The ESLint ignore list ignores `.next/`, but generated `.next-dev/` may still be present after using the dev server.

Clean it and rerun lint:

```bash
cd riscv
npm run clean:next:dev
npm run lint
```

Do not edit generated `.next` or `.next-dev` files.

## Stale Build Or Weird Next.js Behavior

Clean generated output:

```bash
cd riscv
npm run clean:next
npm run clean:next:dev
```

Then restart `npm run dev`.

## Port Conflicts

Expected local ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:25565`
- Local PostgreSQL convention: `5432`

If port `25565` is already in use, the frontend proxy routes must be changed or the conflicting process must be stopped. If port `3000` is busy, Next.js may offer another port, but shared docs and links assume `3000`.

## Tests

Backend tests:

```bash
cd prototype_interp
uv run python -m pytest
```

Frontend checks:

```bash
cd riscv
npm run build
npm run lint
```
