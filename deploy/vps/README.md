## VPS deployment scaffold (GoDaddy VPS)

This folder contains **templates** for deploying the monorepo projects behind Nginx on a single VPS.

- `nginx/`: Nginx server blocks per project subdomain
- `compose/`: per-project `docker-compose.vps.yml` templates

### Expected subdomains

- `p4.<yourdomain>` → Project 4 (this repo’s FastAPI + Next.js + Postgres)
- `p1.<yourdomain>` → Project 1
- `p2.<yourdomain>` → Project 2
- `p3.<yourdomain>` → Project 3

