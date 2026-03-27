# Capstone

Monorepo with Next.js frontend, FastAPI backend, and PostgreSQL (pgvector). Docker Compose runs everything with one command.

## Quick Start

Prereqs: Docker, Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:3000` for the frontend.
Backend API: `http://localhost:8000`
DB runs on `localhost:5432` (user: `app`, password: `app_password`, db: `app`).

## Structure

- `frontend/`: Next.js 16 + Tailwind
- `backend/`: FastAPI + psycopg
- `db/`: init scripts (pgvector)

## Acceptance Criteria

- Single command to run stack: `docker compose up`
- Frontend and backend communicate (frontend calls `backend:8000` via env)
- Database connection succeeds (backend connects to PostgreSQL)

## Test Scenarios

New developer onboarding
1. Clone repo
2. Run `docker compose up --build`
3. Visit `http://localhost:3000` and `http://localhost:8000/docs` (FastAPI docs)

Expected: all services start without errors; Next.js page loads; FastAPI docs accessible.

## Branching Strategy (GitFlow-lite)

- `main`: stable releases
- `develop`: integration branch
- Feature branches: `feature/<name>` → PR into `develop`
- Release branches: `release/<version>` → merge to `main` and `develop`
- Hotfix branches: `hotfix/<name>` → PR into `main` and `develop`

## Local Development (without Docker)

Frontend:
```bash
cd frontend && npm install && npm run dev
```

Backend:
```bash
export CREATEAI_API_TOKEN="your-token"
# or set it in the .env file with:
# CREATEAI_API_TOKEN="your-token"
# Optional: export CREATEAI_API_URL="https://api-main.aiml.asu.edu/query"
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Configuration

### Frontend
- `NEXT_PUBLIC_API_URL`: Base URL the browser uses when calling FastAPI.
  Defaults to `http://localhost:8000`, which works for both local dev and Docker because
  the backend is published on the host. Override it when deploying elsewhere.

### Backend
- `CORS_ALLOW_ORIGINS`: Comma-separated list of origins that FastAPI should
  allow. The default enables `http://localhost:3000`, `http://127.0.0.1:3000`, and the
  Docker service name `http://frontend:3000`. Set this if your frontend is served from a
  different domain.
- `CREATEAI_API_TOKEN`: Required token for CreateAI service authentication
- `CREATEAI_API_URL`: Optional CreateAI API endpoint URL (defaults to `https://api-main.aiml.asu.edu/query`)
- `DATABASE_URL`: PostgreSQL connection string (automatically set in Docker Compose)

### Pinecone (optional)
Vector store for RAG or semantic search. If not set, Pinecone is disabled and the app runs without it.
- `PINECONE_API_KEY`: API key from [Pinecone console](https://app.pinecone.io)
- `PINECONE_HOST`: Index host URL (e.g. `your-index-xxx.svc.region.pinecone.io`), shown in the console for your index
- `PINECONE_INDEX`: Index name (optional; used for `/pinecone/status` index description)
- `PINECONE_ENVIRONMENT`: Optional; some setups use it for control-plane host

### Local Embeddings (full-control RAG)
- `LOCAL_EMBEDDING_MODEL`: Defaults to `BAAI/bge-small-en-v1.5` (via `fastembed`).
- `LOCAL_EMBEDDING_DIM`: Defaults to `384` and should match Pinecone index dimension.
- No API key is required for local embeddings.

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login (returns JWT token)
- `GET /auth/protected` - Protected route (requires JWT token)
- `GET /auth/users/me` - Get current user info (requires JWT token)

### AI/Query
- `POST /fetch/query` - Query CreateAI service with custom prompts
- `POST /fetch/quiz` - Generate quiz questions

### Pinecone
- `GET /pinecone/status` - Returns whether Pinecone is configured and optional index info (safe when disabled)
- `POST /pinecone/ingest` - Chunk + embed + upsert document text into Pinecone
- `POST /pinecone/ingest-folder` - Bulk ingest files from mounted knowledge-base folder
- `POST /pinecone/search` - Embed query text and search top-k vectors from Pinecone

### Knowledge Base Folder Ingestion
- Place PDFs/files in `Knowledge Base/` at repo root.
- Backend container mounts this folder as `/app/knowledge-base`.
- Use `POST /pinecone/ingest-folder` with default `folder_path` to ingest all PDFs.

### API Documentation
- Interactive API docs: `http://localhost:8000/docs` (Swagger UI)

### Environment Variables

The backend requires the following environment variables for AI functionality:
- `CREATEAI_API_TOKEN` (required): Token for CreateAI service authentication
- `CREATEAI_API_URL` (optional): CreateAI API endpoint URL (defaults to `https://api-main.aiml.asu.edu/query`)
- `DATABASE_URL` (required for Docker): PostgreSQL connection string
- `CORS_ALLOW_ORIGINS` (optional): Comma-separated list of allowed CORS origins

