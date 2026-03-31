import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.models import domain_models
from app.services.db import engine
from app.api import auth, fetch, pinecone, progress
    #, webhooks, ai, analytics, pushback, health

app = FastAPI(title="Canvas AI Tutor")

raw_origins = os.getenv("CORS_ALLOW_ORIGINS")
if raw_origins:
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ]

allow_credentials = True
if "*" in allowed_origins:
    allowed_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=allow_credentials,
)

@app.on_event("startup")
def _init_db_with_retry() -> None:
    """
    Docker Compose often starts the backend before Postgres is ready to accept
    connections. If we run create_all() at import time, the process crashes and
    the frontend sees "Failed to fetch". Retry briefly on startup instead.
    """

    max_wait_s = int(os.getenv("DB_INIT_MAX_WAIT_SECONDS", "45"))
    deadline = time.time() + max_wait_s
    attempt = 0

    while True:
        attempt += 1
        try:
            domain_models.Base.metadata.create_all(bind=engine)
            return
        except OperationalError:
            if time.time() >= deadline:
                raise
            # capped backoff: 0.5s, 1s, 2s, 3s, 3s, ...
            sleep_s = min(3.0, 0.5 * (2 ** max(0, attempt - 1)))
            time.sleep(sleep_s)

# app.include_router(health.router, prefix="/")
app.include_router(auth.router, prefix="/auth")
app.include_router(fetch.router, prefix="/fetch")
app.include_router(progress.router, prefix="/progress")
app.include_router(pinecone.router)
# app.include_router(webhooks.router, prefix="/webhooks")
# app.include_router(ai.router, prefix="/ai")
# app.include_router(analytics.router, prefix="/analytics")
# app.include_router(pushback.router, prefix="/pushback")
#
