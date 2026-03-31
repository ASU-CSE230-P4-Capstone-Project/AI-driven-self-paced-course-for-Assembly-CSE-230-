import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

domain_models.Base.metadata.create_all(bind=engine)

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
