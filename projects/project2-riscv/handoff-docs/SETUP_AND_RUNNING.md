# Setup And Running

This guide assumes you are starting from the Capstone2 repo root.

MAIN GUIDE TO SETUP AND RUN THIS REPOSITORY AS A FUNCTIONING APP

## Step 1: Install Dependencies

General:

Install fnm:
1. brew install fnm
2. Choose one of the following:

Windows: 
notepad $PROFILE
fnm env --use-on-cd | Out-String | Invoke-Expression

Mac:
echo 'eval "$(fnm env --use-on-cd)"' >> ~/.zshrc
source ~/.zshrc

Linux
echo 'eval "$(fnm env --use-on-cd)"' >> ~/.bashrc
source ~/.bashrc

3. cd riscv
4. fnm install 23.5.0
5. fnm use 23.5.0
6. echo “23.5.0” > .nvmrc (SKIP STEP 6 IF THIS FILE IS ALREADY IN REPO)

Frontend:

```bash
cd riscv
npm ci
```

Backend:

```bash
cd prototype_interp
uv sync
```

## Step 2: Database Setup

Follow the instructions here:

Capstone2/handoff-docs/Database_Setup_instructions.md


## Step 3: Configure Environment Variables

Frontend:

```bash
cd riscv
cp .env.example .env
```

Set this in `riscv/.env` (there should already be a working url from env.example if you follow this guide exactly, but here is the skeleton for the url):


DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
BACKEND_URL=http://localhost:25565

Backend:

```bash
cd prototype_interp
cp .env.example .env
```

Set this in `prototype_interp` (there should already be a working url from env.example if you follow this guide exactly, but here is the skeleton for the url):


DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require


If `DATABASE_URL` is not set, the backend falls back to:

```text
DB_HOST=localhost
DB_NAME=capstone
DB_USER=capstone
DB_PASSWORD=capstone
DB_PORT=5432
```

## IMPORTANT: Do not commit real `.env` files.


## Step 4: Run the application

Terminal 1, backend:

```bash
cd prototype_interp
uv run python server.py
```

The Flask backend runs on `http://localhost:25565`.

The frontend proxy routes use `BACKEND_URL` when it is set, otherwise they default to `http://localhost:25565`. For hosted frontend deployments, deploy the Flask backend separately and set `BACKEND_URL` in the frontend host environment to that backend's public URL.

Terminal 2, frontend:

```bash
cd riscv
npm run dev
```

NOTE: POSTGRES DATABASE MUST BE RUNNING AND CONNECTED IN ORDER TO START THIS APPLICATION


The Next.js frontend usually runs on `http://localhost:3000`.


## Useful Checks

Frontend:

```bash
cd riscv
npm run build
npm run lint
```

Backend:

```bash
cd prototype_interp
uv run python -m pytest
```

Note: if `npm run lint` reports errors from `.next-dev`, clean generated output first:

```bash
cd riscv
npm run clean:next:dev
npm run lint
```
