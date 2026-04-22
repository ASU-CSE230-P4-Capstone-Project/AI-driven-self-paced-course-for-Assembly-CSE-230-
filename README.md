# CSE 230 Capstone — Project 4 Portal + Projects 1–3

This repository is a **monorepo** containing **Project 4** (the portal / Canvas-integrated course app) plus the full code for **Projects 1–3** under `projects/`.

Production intent:
- **Project 4 is the portal** students/staff log into
- Projects 1–3 run as standalone apps on the VPS and are accessed via the portal UI (links)

## Quick start (Project 4)

Prereqs: Docker + Docker Compose.

```bash
docker compose up -d --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`

Stop:

```bash
docker compose down
```

## Repo structure

- **Project 4**
  - `frontend/`: Next.js
  - `backend/`: FastAPI
  - `db/`: Postgres init scripts
  - `docker-compose.yml`: local stack for Project 4
- **Projects 1–3 (vendored)**
  - `projects/project1-mips/`
  - `projects/project2-riscv/`
  - `projects/project3-x86/`

## Key integrations in Project 4

- **Canvas LMS**
  - Student ↔ Canvas mapping (SIS/email lookup)
  - Auto-post mastery quiz grades to Canvas (best-effort)
  - Staff utilities to reset/recreate mastery assignments and repost grades
- **Dynamic modules**
  - Staff CRUD for modules/resources (PDF upload + markdown)
  - Student view gated by `modules.is_published`

## GoDaddy VPS deployment (recommended)

We deploy all 4 projects onto the VPS, keep their envs isolated, and route by subdomain through Nginx.

### DNS (subdomains)

Create A records pointing to your VPS IP:
- `p4.yourdomain.com` (Project 4 frontend)
- `p1.yourdomain.com` (Project 1)
- `p2.yourdomain.com` (Project 2)
- `p3.yourdomain.com` (Project 3)

### VPS prerequisites

Install:
- Docker + Docker Compose plugin
- Nginx
- certbot (Let’s Encrypt)

### Compose + Nginx templates (this repo)

This repo includes a complete set of templates under:
- `deploy/vps/nginx/` (server blocks)
- `deploy/vps/compose/` (per-project `docker-compose.vps.yml`)

### Project 4 (portal) on VPS

1. SSH into your VPS and clone this repo.
2. Start Project 4 using the provided template:

```bash
cd deploy/vps/compose/project4
docker compose -f docker-compose.vps.yml up -d --build
```

This binds **only to localhost**:
- Project 4 frontend: `127.0.0.1:21004`
- Project 4 backend: `127.0.0.1:28000`
- Postgres: `127.0.0.1:25432`

3. Update the `environment:` section in `deploy/vps/compose/project4/docker-compose.vps.yml`:
- **Canvas vars**: `CANVAS_BASE_URL`, `USER_ACCESS_TOKEN`, `COURSE_ID`
- **Portal external links**: `NEXT_PUBLIC_PROJECT1_URL`, `NEXT_PUBLIC_PROJECT2_URL`, `NEXT_PUBLIC_PROJECT3_URL`

4. Proxy `p4.yourdomain.com` → `127.0.0.1:21004` with Nginx.

```bash
sudo cp deploy/vps/nginx/p4.conf /etc/nginx/sites-available/p4.conf
sudo ln -sf /etc/nginx/sites-available/p4.conf /etc/nginx/sites-enabled/p4.conf
sudo nginx -t && sudo systemctl reload nginx
```

### Projects 1–3 on VPS

Each project runs as its **own stack** (separate env, separate ports).

Run the templates:

```bash
cd deploy/vps/compose/project1
docker compose -f docker-compose.vps.yml up -d --build

cd ../project2
docker compose -f docker-compose.vps.yml up -d --build

cd ../project3
docker compose -f docker-compose.vps.yml up -d --build
```

Then proxy:
- `p1.yourdomain.com` → `127.0.0.1:21001`
- `p2.yourdomain.com` → `127.0.0.1:21002`
- `p3.yourdomain.com` → `127.0.0.1:21003`

```bash
sudo cp deploy/vps/nginx/p1.conf /etc/nginx/sites-available/p1.conf
sudo cp deploy/vps/nginx/p2.conf /etc/nginx/sites-available/p2.conf
sudo cp deploy/vps/nginx/p3.conf /etc/nginx/sites-available/p3.conf
sudo ln -sf /etc/nginx/sites-available/p1.conf /etc/nginx/sites-enabled/p1.conf
sudo ln -sf /etc/nginx/sites-available/p2.conf /etc/nginx/sites-enabled/p2.conf
sudo ln -sf /etc/nginx/sites-available/p3.conf /etc/nginx/sites-enabled/p3.conf
sudo nginx -t && sudo systemctl reload nginx
```

### Nginx reverse proxy

Map each subdomain to an internal port (per project). Example:
- `p4.yourdomain.com` → Project 4 frontend port
- `p1.yourdomain.com` → Project 1 port
- etc.

### TLS (HTTPS)

Use certbot to provision certificates:

```bash
sudo certbot --nginx
```

### Portal “Other projects” links (Project 4)

Project 4 includes a “Other projects” section (student + staff dashboards) driven by these env vars:
- `NEXT_PUBLIC_PROJECT1_URL`
- `NEXT_PUBLIC_PROJECT2_URL`
- `NEXT_PUBLIC_PROJECT3_URL`

## Local development (Project 4, without Docker)

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Run all projects locally (P1–P4)

This repo includes a helper script that starts all projects with non-conflicting ports:

```bash
./scripts/run-all-local.sh
```

Local URLs:
- Project 4 (portal): `http://localhost:3000` (API `http://localhost:8000`)
- Project 1 (MIPS): `http://localhost:3001`
- Project 2 (RISC-V): `http://localhost:3002` (API `http://localhost:25565`)
- Project 3 (x86): `http://localhost:5173`


