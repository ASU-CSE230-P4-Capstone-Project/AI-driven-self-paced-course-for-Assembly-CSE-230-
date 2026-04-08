# grade.py  
import os
import logging
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# load .env (if present)
load_dotenv()

# --- config (read from env)
CANVAS_BASE = os.getenv("CANVAS_BASE_URL", "").rstrip("/")
CANVAS_TOKEN = os.getenv("USER_ACCESS_TOKEN", "")
COURSE_ID = os.getenv("COURSE_ID", "")

# --- logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("canvas-grade")

# --- FastAPI app
app = FastAPI(title="Canvas Grade Push (single-course)")

class GradeRequest(BaseModel):
    assignment_id: int
    user_id: int
    posted_grade: str  # grade value as text, e.g. "95", "A", "complete"

# Root
@app.get("/")
def root() -> dict:
    return {"status": "ok", "service": "Canvas grade push", "course_id_present": bool(COURSE_ID)}

# Health (basic local)
@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "canvas_base_configured": bool(CANVAS_BASE),
        "user_token_configured": bool(CANVAS_TOKEN),
        "course_id_configured": bool(COURSE_ID)
    }

# Canvas integration check
@app.get("/canvas-status")
async def canvas_status() -> dict:
    """
    Returns whether Canvas integration appears configured and working.
    - If env vars missing: returns integrated: false with details.
    - If configured: attempts GET /api/v1/courses/{COURSE_ID} to verify access.
    """
    if not CANVAS_BASE:
        return {"integrated": False, "reason": "Missing CANVAS_BASE_URL in environment"}

    if not CANVAS_TOKEN:
        return {"integrated": False, "reason": "Missing USER_ACCESS_TOKEN in environment"}

    if not COURSE_ID:
        return {"integrated": False, "reason": "Missing COURSE_ID in environment"}

    url = f"{CANVAS_BASE}/api/v1/courses/{COURSE_ID}"
    headers = {"Authorization": f"Bearer {CANVAS_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        logger.exception("Failed to reach Canvas")
        return {"integrated": False, "reason": f"Request failed: {exc}"}

    if resp.status_code == 200:
        # return a small summary (avoid dumping entire course payload)
        try:
            j = resp.json()
            summary = {
                "id": j.get("id"),
                "name": j.get("name"),
                "course_code": j.get("course_code"),
                "start_at": j.get("start_at"),
                "workflow_state": j.get("workflow_state"),
            }
        except Exception:
            summary = {"raw": "received 200 but failed to parse JSON"}

        return {"integrated": True, "course_summary": summary}
    else:
        # Forward Canvas error info (useful for debugging)
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        return {"integrated": False, "status_code": resp.status_code, "body": body}

# Push grade (uses COURSE_ID from env only)
@app.post("/push-grade")
async def push_grade(body: GradeRequest) -> Any:
    """
    Push a grade to Canvas for the configured COURSE_ID.
    Uses: PUT /api/v1/courses/{COURSE_ID}/assignments/{assignment_id}/submissions/{user_id}
    NOTE: This endpoint does NOT accept a course_id override; the server uses COURSE_ID from env.
    """
    # runtime checks (friendly HTTP errors)
    if not CANVAS_BASE:
        raise HTTPException(status_code=500, detail="Server misconfigured: CANVAS_BASE_URL not set")
    if not CANVAS_TOKEN:
        raise HTTPException(status_code=500, detail="Server misconfigured: USER_ACCESS_TOKEN not set")
    if not COURSE_ID:
        raise HTTPException(status_code=500, detail="Server misconfigured: COURSE_ID not set")

    url = f"{CANVAS_BASE}/api/v1/courses/{COURSE_ID}/assignments/{body.assignment_id}/submissions/{body.user_id}"
    headers = {"Authorization": f"Bearer {CANVAS_TOKEN}"}
    data = {"submission[posted_grade]": body.posted_grade}

    logger.info("Pushing grade -> url=%s payload=%s", url, data)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.put(url, headers=headers, data=data)
    except httpx.RequestError as e:
        logger.exception("Error pushing grade to Canvas")
        raise HTTPException(status_code=502, detail=f"Failed to reach Canvas: {e}") from e

    if resp.status_code not in (200, 201):
        # bubble Canvas error back to client for debugging
        try:
            canvas_body = resp.json()
        except Exception:
            canvas_body = resp.text or "<no body>"
        logger.error("Canvas API error %s: %s", resp.status_code, canvas_body)
        raise HTTPException(status_code=502, detail={"status_code": resp.status_code, "body": canvas_body})

    # success
    try:
        canvas_resp = resp.json()
    except Exception:
        canvas_resp = {"raw": resp.text}

    return {"ok": True, "canvas_response": canvas_resp}