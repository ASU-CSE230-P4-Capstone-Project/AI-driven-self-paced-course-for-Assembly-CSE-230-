import os
import logging
from typing import Any

import asyncio
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

# --- config (read from env)
CANVAS_BASE = os.getenv("CANVAS_BASE_URL", "").rstrip("/")
CANVAS_TOKEN = os.getenv("USER_ACCESS_TOKEN", "")
COURSE_ID = os.getenv("COURSE_ID", "")
TEACHER_USERIDS = os.getenv("TEACHER_USERIDS", "")

# --- logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("canvas-grade")

router = APIRouter(tags=["canvas"])

from app.api.auth import require_staff, verify_token
from app.models.domain_models import CanvasModuleAssignmentMap, CanvasUserMap, Module, UserModuleProgress, Users
from app.models.request_models import CanvasConnectRequest, CanvasConnectUserRequest
from app.services.db import get_session


def _require_canvas_config() -> tuple[str, str, str]:
    base = (CANVAS_BASE or "").rstrip("/")
    token = CANVAS_TOKEN or ""
    course_id = COURSE_ID or ""
    if not base:
        raise HTTPException(status_code=500, detail="Server misconfigured: CANVAS_BASE_URL not set")
    if not token:
        raise HTTPException(status_code=500, detail="Server misconfigured: USER_ACCESS_TOKEN not set")
    if not course_id:
        raise HTTPException(status_code=500, detail="Server misconfigured: COURSE_ID not set")
    return base, token, course_id


async def canvas_list_assignments() -> list[dict[str, Any]]:
    base, token, course_id = _require_canvas_config()
    url = f"{base}/api/v1/courses/{course_id}/assignments"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"per_page": 100}
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, headers=headers, params=params)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail={"status_code": resp.status_code, "body": resp.text})
    return resp.json()


async def canvas_create_assignment(name: str) -> dict[str, Any]:
    base, token, course_id = _require_canvas_config()
    url = f"{base}/api/v1/courses/{course_id}/assignments"
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "assignment[name]": name,
        # Online quiz-like submission: no file upload needed
        "assignment[submission_types][]": "none",
        "assignment[published]": True,
        "assignment[points_possible]": 100,
    }
    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.post(url, headers=headers, data=data)
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail={"status_code": resp.status_code, "body": resp.text})
    return resp.json()


async def canvas_delete_assignment(assignment_id: int) -> None:
    base, token, course_id = _require_canvas_config()
    url = f"{base}/api/v1/courses/{course_id}/assignments/{int(assignment_id)}"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.delete(url, headers=headers)
    # Canvas returns 200 on success; treat 404 as already-deleted.
    if resp.status_code in (200, 204, 404):
        return
    raise HTTPException(status_code=502, detail={"status_code": resp.status_code, "body": resp.text})


async def canvas_find_user_id_by_search_term(search_term: str) -> dict[str, Any] | None:
    """
    Best-effort lookup: search course users by term (email/login/name) and return first match.
    """
    base, token, course_id = _require_canvas_config()
    term = (search_term or "").strip()
    if not term:
        return None
    url = f"{base}/api/v1/courses/{course_id}/users"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"search_term": term, "per_page": 10}
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, headers=headers, params=params)
    if resp.status_code != 200:
        return None
    rows = resp.json()
    if not isinstance(rows, list) or not rows:
        return None
    u = rows[0] or {}
    if not isinstance(u, dict) or not u.get("id"):
        return None
    return u


class GradeRequest(BaseModel):
    assignment_id: int
    user_id: int
    posted_grade: str  # grade value as text, e.g. "95", "A", "complete"


class OverrideGradeRequest(BaseModel):
    module_id: str
    userid: str
    posted_grade: str  # numeric string, letter grade, etc (Canvas accepts text)


class EnsureModuleAssignmentRequest(BaseModel):
    module_id: int


def _require_teacher(db: Session, userid: str) -> None:
    # Authoritative check: must be staff in DB.
    u = db.query(Users).where(Users.userid == userid).one_or_none()
    role = (u.role if u else "student") or "student"
    if str(role).strip().lower() != "staff":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Optional extra allowlist gate (if configured).
    allowed = [x.strip() for x in (TEACHER_USERIDS or "").split(",") if x.strip()]
    if allowed and userid not in allowed:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/reset-module-assignments")
async def reset_module_assignments(
    db: Session = Depends(get_session),
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    """
    Teacher-only destructive operation:
    - Delete all Canvas assignments matching our mastery naming convention.
    - Recreate them (each out of 100).
    - Upsert CanvasModuleAssignmentMap for every module in our DB.

    WARNING: Deleting assignments removes gradebook columns/history in Canvas.
    """
    _require_teacher(db, userid)

    # Collect module ids from DB
    modules = db.scalars(select(Module).order_by(Module.id.asc())).all()
    module_ids = [str(m.id) for m in modules]

    # Identify existing mastery assignments to delete
    desired_names = {f"Mastery Quiz - Chapter {mid}" for mid in module_ids}
    existing_assignments = await canvas_list_assignments()

    name_to_id: dict[str, int] = {}
    for a in existing_assignments:
        if not isinstance(a, dict):
            continue
        nm = str(a.get("name") or "").strip()
        if nm in desired_names and a.get("id"):
            name_to_id[nm] = int(a["id"])

    # Also include any assignments currently mapped in DB (stale or not)
    mapped_rows = db.scalars(select(CanvasModuleAssignmentMap)).all()
    mapped_ids = {int(r.canvas_assignment_id) for r in mapped_rows if r and r.canvas_assignment_id}

    ids_to_delete = set(name_to_id.values()) | mapped_ids

    report: list[dict[str, Any]] = []
    deleted = 0
    for aid in sorted(ids_to_delete):
        try:
            await canvas_delete_assignment(int(aid))
            deleted += 1
            report.append({"assignment_id": int(aid), "status": "deleted"})
        except HTTPException as exc:
            report.append({"assignment_id": int(aid), "status": "failed", "reason": exc.detail})
        await asyncio.sleep(0.15)

    # Recreate assignments + upsert mapping
    recreated = 0
    for mid in module_ids:
        desired_name = f"Mastery Quiz - Chapter {mid}"
        try:
            created = await canvas_create_assignment(desired_name)
            new_id = int(created["id"])
            amap = db.scalars(
                select(CanvasModuleAssignmentMap).where(CanvasModuleAssignmentMap.module_id == str(mid))
            ).first()
            if amap is None:
                amap = CanvasModuleAssignmentMap(
                    module_id=str(mid),
                    canvas_assignment_id=new_id,
                    assignment_name=str(created.get("name") or desired_name),
                )
                db.add(amap)
            else:
                amap.canvas_assignment_id = new_id
                amap.assignment_name = str(created.get("name") or desired_name)
            db.commit()
            recreated += 1
            report.append(
                {
                    "module_id": str(mid),
                    "status": "recreated",
                    "canvas_assignment_id": int(new_id),
                    "assignment_name": str(created.get("name") or desired_name),
                }
            )
        except Exception as exc:
            report.append({"module_id": str(mid), "status": "failed", "reason": str(exc)})
        await asyncio.sleep(0.15)

    return {
        "ok": True,
        "deleted": int(deleted),
        "recreated": int(recreated),
        "modules": len(module_ids),
        "report": report,
    }


@router.post("/ensure-module-assignment")
async def ensure_module_assignment(
    body: EnsureModuleAssignmentRequest,
    db: Session = Depends(get_session),
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    """
    Teacher utility: ensure a Canvas assignment exists for a given module_id and persist the mapping.
    """
    _require_teacher(db, userid)
    mid = str(int(body.module_id))
    desired_name = f"Mastery Quiz - Chapter {mid}"

    amap = db.scalars(
        select(CanvasModuleAssignmentMap).where(CanvasModuleAssignmentMap.module_id == mid)
    ).first()
    if amap is not None:
        return {
            "ok": True,
            "module_id": mid,
            "canvas_assignment_id": int(amap.canvas_assignment_id),
            "assignment_name": str(amap.assignment_name or desired_name),
            "status": "already-mapped",
        }

    assignments = await canvas_list_assignments()
    match = next((a for a in assignments if (a.get("name") or "").strip() == desired_name), None)
    if match is None:
        match = await canvas_create_assignment(desired_name)

    if not match or not match.get("id"):
        raise HTTPException(status_code=502, detail="Failed to create or resolve Canvas assignment")

    amap = CanvasModuleAssignmentMap(
        module_id=mid,
        canvas_assignment_id=int(match["id"]),
        assignment_name=str(match.get("name") or desired_name),
    )
    db.add(amap)
    db.commit()
    db.refresh(amap)

    return {
        "ok": True,
        "module_id": mid,
        "canvas_assignment_id": int(amap.canvas_assignment_id),
        "assignment_name": str(amap.assignment_name or desired_name),
        "status": "created-or-resolved",
    }


@router.post("/repost-grades")
async def repost_grades_from_db(
    db: Session = Depends(get_session),
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    """
    Teacher utility: Re-post grades to Canvas using persisted progress.
    Useful after deleting/recreating assignments (gradebook history wiped).
    """
    _require_teacher(db, userid)

    rows = db.scalars(select(UserModuleProgress)).all()
    if not rows:
        return {"ok": True, "posted": 0, "skipped": 0, "failed": 0, "report": []}

    # Preload mappings
    umaps = db.scalars(select(CanvasUserMap)).all()
    by_userid: dict[str, CanvasUserMap] = {u.userid: u for u in umaps if u and u.userid}

    amaps = db.scalars(select(CanvasModuleAssignmentMap)).all()
    by_module_id: dict[str, CanvasModuleAssignmentMap] = {a.module_id: a for a in amaps if a and a.module_id}

    posted = 0
    skipped = 0
    failed = 0
    report: list[dict[str, Any]] = []

    for r in rows:
        mid = str(r.module_id)
        uid = str(r.userid)
        umap = by_userid.get(uid)
        amap = by_module_id.get(mid)

        if umap is None:
            skipped += 1
            report.append({"userid": uid, "module_id": mid, "status": "skipped", "reason": "no CanvasUserMap"})
            continue
        if amap is None:
            skipped += 1
            report.append({"userid": uid, "module_id": mid, "status": "skipped", "reason": "no CanvasModuleAssignmentMap"})
            continue

        grade = str(round(float(r.best_score_pct or 0.0), 2))
        try:
            await push_grade(
                GradeRequest(
                    assignment_id=int(amap.canvas_assignment_id),
                    user_id=int(umap.canvas_user_id),
                    posted_grade=grade,
                )
            )
            posted += 1
            report.append(
                {
                    "userid": uid,
                    "module_id": mid,
                    "status": "posted",
                    "posted_grade": grade,
                    "canvas_assignment_id": int(amap.canvas_assignment_id),
                    "canvas_user_id": int(umap.canvas_user_id),
                }
            )
        except Exception as exc:
            failed += 1
            report.append({"userid": uid, "module_id": mid, "status": "failed", "reason": str(exc)})
        await asyncio.sleep(0.15)

    return {"ok": True, "posted": posted, "skipped": skipped, "failed": failed, "report": report}


async def _resolve_canvas_user_from_course_roster(
    *,
    client: httpx.AsyncClient,
    base: str,
    course_id: str,
    headers: dict[str, str],
    sis_user_id: str | None = None,
    email: str | None = None,
) -> dict[str, Any] | None:
    term = (sis_user_id or email or "").strip()
    if not term:
        return None
    resp = await client.get(
        f"{base}/api/v1/courses/{course_id}/users",
        headers=headers,
        params={"search_term": term, "per_page": 25},
    )
    if resp.status_code != 200:
        return None
    rows = resp.json()
    if not isinstance(rows, list) or not rows:
        return None

    if sis_user_id:
        sis = sis_user_id.strip()
        exact_sis = next((r for r in rows if isinstance(r, dict) and str(r.get("sis_user_id") or "").strip() == sis), None)
        if exact_sis:
            return exact_sis

    if email:
        em = email.strip().lower()
        exact_login = next((r for r in rows if isinstance(r, dict) and str(r.get("login_id") or "").lower() == em), None)
        if exact_login:
            return exact_login
        exact_email = next((r for r in rows if isinstance(r, dict) and str(r.get("email") or "").lower() == em), None)
        if exact_email:
            return exact_email

    # fallback: first result
    first = rows[0]
    return first if isinstance(first, dict) else None

# Health (basic local)
@router.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "canvas_base_configured": bool(CANVAS_BASE),
        "user_token_configured": bool(CANVAS_TOKEN),
        "course_id_configured": bool(COURSE_ID)
    }

# Canvas integration check
@router.get("/canvas-status")
async def canvas_status() -> dict:
    """
    Returns whether Canvas integration appears configured and working.
    - If env vars missing: returns integrated: false with details.
    - If configured: attempts GET /api/v1/courses/{COURSE_ID} to verify access.
    """
    try:
        base, token, course_id = _require_canvas_config()
    except HTTPException as exc:
        return {"integrated": False, "reason": str(exc.detail)}

    url = f"{base}/api/v1/courses/{course_id}"
    headers = {"Authorization": f"Bearer {token}"}

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
@router.post("/push-grade")
async def push_grade(body: GradeRequest) -> Any:
    """
    Push a grade to Canvas for the configured COURSE_ID.
    Uses: PUT /api/v1/courses/{COURSE_ID}/assignments/{assignment_id}/submissions/{user_id}
    NOTE: This endpoint does NOT accept a course_id override; the server uses COURSE_ID from env.
    """
    base, token, course_id = _require_canvas_config()

    url = f"{base}/api/v1/courses/{course_id}/assignments/{body.assignment_id}/submissions/{body.user_id}"
    headers = {"Authorization": f"Bearer {token}"}
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


@router.post("/override-grade")
async def override_grade(
    body: OverrideGradeRequest,
    db: Session = Depends(get_session),
    _: str = Depends(verify_token),
) -> Any:
    """
    Instructor override: set a student's grade for a module's mastery assignment on Canvas.
    Uses mappings in Postgres; creates them on demand when possible.
    """
    module_id = str(body.module_id).strip()
    userid = str(body.userid).strip()
    if not module_id or not userid:
        raise HTTPException(status_code=400, detail="module_id and userid are required")

    desired_name = f"Mastery Quiz - Chapter {module_id}"

    amap = db.scalars(
        select(CanvasModuleAssignmentMap).where(CanvasModuleAssignmentMap.module_id == module_id)
    ).first()
    if amap is None:
        assignments = await canvas_list_assignments()
        match = next((a for a in assignments if (a.get("name") or "").strip() == desired_name), None)
        if match is None:
            match = await canvas_create_assignment(desired_name)
        amap = CanvasModuleAssignmentMap(
            module_id=module_id,
            canvas_assignment_id=int(match["id"]),
            assignment_name=str(match.get("name") or desired_name),
        )
        db.add(amap)
        db.commit()

    umap = db.scalars(select(CanvasUserMap).where(CanvasUserMap.userid == userid)).first()
    if umap is None:
        found = await canvas_find_user_id_by_search_term(userid)
        if not found:
            raise HTTPException(status_code=404, detail=f"Could not find Canvas user for '{userid}'")
        umap = CanvasUserMap(
            userid=userid,
            canvas_user_id=int(found["id"]),
            canvas_login_id=str(found.get("login_id") or found.get("sis_user_id") or "") or None,
        )
        db.add(umap)
        db.commit()

    return await push_grade(
        GradeRequest(
            assignment_id=int(amap.canvas_assignment_id),
            user_id=int(umap.canvas_user_id),
            posted_grade=str(body.posted_grade),
        )
    )


@router.post("/connect-me")
async def connect_me_to_canvas(
    body: CanvasConnectRequest,
    db: Session = Depends(get_session),
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    """
    Persist a deterministic mapping between our userid and a Canvas numeric user_id.
    This avoids fragile roster search-term matching and supports new users once enrolled in Canvas.
    """
    base, token, course_id = _require_canvas_config()
    headers = {"Authorization": f"Bearer {token}"}

    provided = [
        bool(body.canvas_user_id),
        bool((body.sis_user_id or "").strip()),
        bool((body.email or "").strip()),
    ]
    if sum(1 for x in provided if x) != 1:
        raise HTTPException(status_code=400, detail="Provide exactly one of: canvas_user_id, sis_user_id, email")

    resolved_canvas_user_id: int | None = None

    async with httpx.AsyncClient(timeout=20.0) as client:
        if body.canvas_user_id:
            resolved_canvas_user_id = int(body.canvas_user_id)
        elif (body.sis_user_id or "").strip():
            sis = (body.sis_user_id or "").strip()
            chosen = await _resolve_canvas_user_from_course_roster(
                client=client,
                base=base,
                course_id=course_id,
                headers=headers,
                sis_user_id=sis,
            )
            if not chosen or not chosen.get("id"):
                raise HTTPException(
                    status_code=400,
                    detail="No Canvas user found for that SIS id in the course roster. Make sure you're enrolled in Canvas.",
                )
            resolved_canvas_user_id = int(chosen["id"])
        else:
            email = (body.email or "").strip()
            chosen = await _resolve_canvas_user_from_course_roster(
                client=client,
                base=base,
                course_id=course_id,
                headers=headers,
                email=email,
            )
            if not chosen or not chosen.get("id"):
                raise HTTPException(
                    status_code=400,
                    detail="No Canvas user found for that email in the course roster. Make sure you're enrolled in Canvas.",
                )
            resolved_canvas_user_id = int(chosen["id"])

        if not resolved_canvas_user_id:
            raise HTTPException(status_code=400, detail="Could not resolve a Canvas user id.")

        # Validate enrollment: user must exist in this course roster.
        resp = await client.get(
            f"{base}/api/v1/courses/{course_id}/users/{resolved_canvas_user_id}",
            headers=headers,
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Canvas user not found in course roster. Make sure you are enrolled in the Canvas course, "
                    "then try again."
                ),
            )

        payload = resp.json() if resp.content else {}
        login_id = payload.get("login_id") or payload.get("sis_user_id")

    row = db.scalars(select(CanvasUserMap).where(CanvasUserMap.userid == userid)).first()
    if row is None:
        row = CanvasUserMap(
            userid=userid,
            canvas_user_id=int(resolved_canvas_user_id),
            canvas_login_id=str(login_id) if login_id else None,
        )
        db.add(row)
    else:
        row.canvas_user_id = int(resolved_canvas_user_id)
        row.canvas_login_id = str(login_id) if login_id else row.canvas_login_id

    db.commit()
    db.refresh(row)

    return {"ok": True, "userid": userid, "canvas_user_id": int(row.canvas_user_id)}


@router.get("/me")
async def my_canvas_connection(
    db: Session = Depends(get_session),
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    row = db.scalars(select(CanvasUserMap).where(CanvasUserMap.userid == userid)).first()
    if row is None:
        return {"connected": False}
    return {
        "connected": True,
        "canvas_user_id": int(row.canvas_user_id),
        "canvas_login_id": str(row.canvas_login_id) if row.canvas_login_id else None,
    }

@router.post("/connect-user")
async def connect_platform_user_to_canvas(
    body: CanvasConnectUserRequest,
    db: Session = Depends(get_session),
    requester: str = Depends(verify_token),
) -> dict[str, Any]:
    """
    Instructor/admin utility: link a specific platform userid to a Canvas user using SIS id or email.
    This is useful for testing and for students who signed up with non-matching emails.
    """
    _require_teacher(db, requester)

    target_userid = (body.userid or "").strip()
    if not target_userid:
        raise HTTPException(status_code=400, detail="userid is required")

    # Reuse connect logic by resolving to a canvas_user_id first.
    base, token, course_id = _require_canvas_config()
    headers = {"Authorization": f"Bearer {token}"}

    provided = [
        bool(body.canvas_user_id),
        bool((body.sis_user_id or "").strip()),
        bool((body.email or "").strip()),
    ]
    if sum(1 for x in provided if x) != 1:
        raise HTTPException(status_code=400, detail="Provide exactly one of: canvas_user_id, sis_user_id, email")

    async with httpx.AsyncClient(timeout=20.0) as client:
        if body.canvas_user_id:
            resolved_canvas_user_id = int(body.canvas_user_id)
        elif (body.sis_user_id or "").strip():
            chosen = await _resolve_canvas_user_from_course_roster(
                client=client,
                base=base,
                course_id=course_id,
                headers=headers,
                sis_user_id=(body.sis_user_id or "").strip(),
            )
            if not chosen or not chosen.get("id"):
                raise HTTPException(status_code=400, detail="No Canvas user found for that SIS id in the course roster.")
            resolved_canvas_user_id = int(chosen["id"])
        else:
            chosen = await _resolve_canvas_user_from_course_roster(
                client=client,
                base=base,
                course_id=course_id,
                headers=headers,
                email=(body.email or "").strip(),
            )
            if not chosen or not chosen.get("id"):
                raise HTTPException(status_code=400, detail="No Canvas user found for that email in the course roster.")
            resolved_canvas_user_id = int(chosen["id"])

        # Validate enrollment.
        v = await client.get(
            f"{base}/api/v1/courses/{course_id}/users/{resolved_canvas_user_id}",
            headers=headers,
        )
        if v.status_code != 200:
            raise HTTPException(status_code=400, detail="Canvas user not found in course roster.")
        payload = v.json() if v.content else {}
        login_id = payload.get("login_id") or payload.get("sis_user_id")

    row = db.scalars(select(CanvasUserMap).where(CanvasUserMap.userid == target_userid)).first()
    if row is None:
        row = CanvasUserMap(
            userid=target_userid,
            canvas_user_id=int(resolved_canvas_user_id),
            canvas_login_id=str(login_id) if login_id else None,
        )
        db.add(row)
    else:
        row.canvas_user_id = int(resolved_canvas_user_id)
        row.canvas_login_id = str(login_id) if login_id else row.canvas_login_id
    db.commit()
    db.refresh(row)

    return {"ok": True, "userid": target_userid, "canvas_user_id": int(row.canvas_user_id)}


@router.post("/backfill-users")
async def backfill_canvas_user_mappings(
    db: Session = Depends(get_session),
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    """
    Instructor utility: for platform users missing a Canvas mapping, attempt to find their Canvas user
    in the course roster using their platform userid (typically email) and persist it in Postgres.
    """
    _require_teacher(db, userid)

    users = db.scalars(select(Users)).all()
    if not users:
        return {"ok": True, "linked": 0, "skipped": 0, "unmatched": 0, "report": []}

    base, token, course_id = _require_canvas_config()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{base}/api/v1/courses/{course_id}/users"

    linked = 0
    skipped = 0
    unmatched = 0
    report: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=25.0) as client:
        for u in users:
            u_userid = (u.userid or "").strip()
            if not u_userid:
                skipped += 1
                report.append({"userid": None, "status": "skipped", "reason": "blank userid"})
                continue

            existing = db.scalars(select(CanvasUserMap).where(CanvasUserMap.userid == u_userid)).first()
            if existing is not None:
                skipped += 1
                report.append({"userid": u_userid, "status": "skipped", "reason": "already mapped"})
                continue

            try:
                resp = await client.get(url, headers=headers, params={"search_term": u_userid, "per_page": 5})
            except Exception:
                unmatched += 1
                report.append({"userid": u_userid, "status": "unmatched", "reason": "request error"})
                continue

            if resp.status_code != 200:
                unmatched += 1
                report.append(
                    {"userid": u_userid, "status": "unmatched", "reason": f"canvas http {resp.status_code}"}
                )
                continue

            rows = resp.json()
            if not isinstance(rows, list) or not rows:
                unmatched += 1
                report.append({"userid": u_userid, "status": "unmatched", "reason": "not in course roster"})
                continue

            found = rows[0] if isinstance(rows[0], dict) else None
            if not found or not found.get("id"):
                unmatched += 1
                report.append({"userid": u_userid, "status": "unmatched", "reason": "invalid canvas response"})
                continue

            row = CanvasUserMap(
                userid=u_userid,
                canvas_user_id=int(found["id"]),
                canvas_login_id=str(found.get("login_id") or found.get("sis_user_id") or "") or None,
            )
            db.add(row)
            linked += 1
            report.append(
                {
                    "userid": u_userid,
                    "status": "linked",
                    "canvas_user_id": int(found["id"]),
                    "canvas_login_id": found.get("login_id") or found.get("sis_user_id"),
                }
            )

        db.commit()

    return {"ok": True, "linked": linked, "skipped": skipped, "unmatched": unmatched, "report": report}