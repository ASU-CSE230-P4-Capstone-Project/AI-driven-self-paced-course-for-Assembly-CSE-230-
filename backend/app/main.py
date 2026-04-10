import os
import time
from sqlalchemy.exc import OperationalError

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import domain_models
from app.services.db import engine
from app.api import auth, canvas_route, fetch
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
def create_tables():
    """Create database tables with retry logic for Docker startup."""
    max_retries = 10
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            domain_models.Base.metadata.create_all(bind=engine)
            print(f"✓ Database tables created successfully")
            return
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"⚠️  Database not ready (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                print(f"✗ Failed to connect to database after {max_retries} attempts")
                raise

# app.include_router(health.router, prefix="/")
app.include_router(auth.router, prefix="/auth")
app.include_router(fetch.router, prefix="/fetch")
app.include_router(canvas_route.router, prefix="/canvas")
# app.include_router(webhooks.router, prefix="/webhooks")
# app.include_router(ai.router, prefix="/ai")
# app.include_router(analytics.router, prefix="/analytics")
# app.include_router(pushback.router, prefix="/pushback")
#
