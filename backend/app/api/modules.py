import os
import re
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import require_staff, verify_token
from app.models.domain_models import CanvasModuleAssignmentMap, Module, ModuleResource, UserModuleProgress, UserTopicProgress, Users
from app.models.request_models import ModuleCreateRequest, ModuleOut, ModuleResourceOut, ModuleUpdateRequest
from app.services.db import get_session

router = APIRouter(tags=["modules"])
DbSession = Annotated[Session, Depends(get_session)]


def _is_teacher(userid: str) -> bool:
    # Deprecated: teacher authorization is DB-backed now (see require_staff).
    # Keep as a fallback helper for any legacy usage.
    allowed = [x.strip() for x in (os.getenv("TEACHER_USERIDS", "") or "").split(",") if x.strip()]
    return userid in allowed


def _uploads_dir() -> str:
    # backend/app/static/uploads
    base_dir = os.path.join(os.path.dirname(__file__), "..", "static", "uploads")
    base_dir = os.path.abspath(base_dir)
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


@router.post("/modules/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    _: str = Depends(require_staff),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="file is required")
    if (file.content_type or "").lower() not in ("application/pdf", "application/x-pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", file.filename)
    fname = f"{uuid.uuid4().hex}_{safe_name}"
    path = os.path.join(_uploads_dir(), fname)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    with open(path, "wb") as f:
        f.write(content)

    return {"ok": True, "url": f"/static/uploads/{fname}", "filename": safe_name}


@router.get("/modules")
async def list_modules(
    db: DbSession,
    userid: str = Depends(verify_token),
) -> list[dict[str, Any]]:
    q = select(Module).order_by(Module.id.asc())
    # For students, return all modules so the UI can show locked/unlocked state.
    # Details for unpublished modules are still protected by GET /modules/{id}.

    rows = db.scalars(q).all()
    return [
        {
            "id": int(m.id),
            "title": str(m.title),
            "description": str(m.description or ""),
            "is_published": bool(m.is_published),
        }
        for m in rows
    ]


@router.get("/modules/{module_id}", response_model=ModuleOut)
async def get_module(
    module_id: int,
    db: DbSession,
    userid: str = Depends(verify_token),
) -> ModuleOut:
    # Staff users can view unpublished module details (students cannot).
    u = db.query(Users).where(Users.userid == userid).one_or_none()
    role = (u.role if u else "student") or "student"
    is_teacher = str(role).strip().lower() == "staff"
    m = db.scalars(select(Module).where(Module.id == int(module_id))).first()
    if m is None:
        raise HTTPException(status_code=404, detail="Module not found")
    if not is_teacher and not bool(m.is_published):
        raise HTTPException(status_code=404, detail="Module not found")

    resources = db.scalars(
        select(ModuleResource).where(ModuleResource.module_id == int(module_id)).order_by(ModuleResource.id.asc())
    ).all()

    return ModuleOut(
        id=int(m.id),
        title=str(m.title),
        description=str(m.description or ""),
        is_published=bool(m.is_published),
        resources=[
            ModuleResourceOut(
                id=int(r.id),
                kind=str(r.kind),
                title=str(r.title),
                duration=str(r.duration or ""),
                url=str(r.url) if r.url else None,
                content_markdown=str(r.content_markdown) if getattr(r, "content_markdown", None) else None,
            )
            for r in resources
        ],
    )


@router.post("/modules", response_model=ModuleOut)
async def create_module(
    body: ModuleCreateRequest,
    db: DbSession,
    _: str = Depends(require_staff),
) -> ModuleOut:
    m = Module(
        title=body.title.strip(),
        description=(body.description or "").strip(),
        is_published=bool(body.is_published),
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    for r in body.resources or []:
        kind = (r.kind or "").strip().lower()
        if kind not in ("reading", "video"):
            continue
        db.add(
            ModuleResource(
                module_id=int(m.id),
                kind=kind,
                title=r.title.strip(),
                duration=(r.duration or "").strip(),
                url=(r.url or "").strip() or None,
                content_markdown=(r.content_markdown or "").strip() or None,
            )
        )
    db.commit()

    # Return with resources
    res_rows = db.scalars(
        select(ModuleResource).where(ModuleResource.module_id == int(m.id)).order_by(ModuleResource.id.asc())
    ).all()

    return ModuleOut(
        id=int(m.id),
        title=str(m.title),
        description=str(m.description or ""),
        is_published=bool(m.is_published),
        resources=[
            ModuleResourceOut(
                id=int(r.id),
                kind=str(r.kind),
                title=str(r.title),
                duration=str(r.duration or ""),
                url=str(r.url) if r.url else None,
                content_markdown=str(r.content_markdown) if getattr(r, "content_markdown", None) else None,
            )
            for r in res_rows
        ],
    )


@router.put("/modules/{module_id}", response_model=ModuleOut)
async def update_module(
    module_id: int,
    body: ModuleUpdateRequest,
    db: DbSession,
    _: str = Depends(require_staff),
) -> ModuleOut:
    m = db.scalars(select(Module).where(Module.id == int(module_id))).first()
    if m is None:
        raise HTTPException(status_code=404, detail="Module not found")

    if body.title is not None:
        m.title = body.title.strip()
    if body.description is not None:
        m.description = (body.description or "").strip()
    if body.is_published is not None:
        m.is_published = bool(body.is_published)

    if body.resources is not None:
        # Replace resources for simplicity (safe + deterministic for v1)
        db.query(ModuleResource).where(ModuleResource.module_id == int(module_id)).delete()
        for r in body.resources:
            kind = (r.kind or "").strip().lower()
            if kind not in ("reading", "video"):
                continue
            db.add(
                ModuleResource(
                    module_id=int(module_id),
                    kind=kind,
                    title=r.title.strip(),
                    duration=(r.duration or "").strip(),
                    url=(r.url or "").strip() or None,
                    content_markdown=(r.content_markdown or "").strip() or None,
                )
            )

    db.commit()
    db.refresh(m)

    res_rows = db.scalars(
        select(ModuleResource).where(ModuleResource.module_id == int(m.id)).order_by(ModuleResource.id.asc())
    ).all()

    return ModuleOut(
        id=int(m.id),
        title=str(m.title),
        description=str(m.description or ""),
        is_published=bool(m.is_published),
        resources=[
            ModuleResourceOut(
                id=int(r.id),
                kind=str(r.kind),
                title=str(r.title),
                duration=str(r.duration or ""),
                url=str(r.url) if r.url else None,
                content_markdown=str(r.content_markdown) if getattr(r, "content_markdown", None) else None,
            )
            for r in res_rows
        ],
    )


@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: int,
    db: DbSession,
    _: str = Depends(require_staff),
) -> dict[str, Any]:
    m = db.scalars(select(Module).where(Module.id == int(module_id))).first()
    if m is None:
        raise HTTPException(status_code=404, detail="Module not found")

    mid_str = str(int(module_id))

    # Clean related rows so we don't keep trash.
    deleted_resources = db.query(ModuleResource).where(ModuleResource.module_id == int(module_id)).delete()
    deleted_progress = db.query(UserModuleProgress).where(UserModuleProgress.module_id == mid_str).delete()
    deleted_topics = db.query(UserTopicProgress).where(UserTopicProgress.module_id == mid_str).delete()
    deleted_canvas_map = db.query(CanvasModuleAssignmentMap).where(CanvasModuleAssignmentMap.module_id == mid_str).delete()

    db.delete(m)
    db.commit()

    return {
        "ok": True,
        "module_id": int(module_id),
        "deleted": {
            "module_resources": int(deleted_resources or 0),
            "user_module_progress": int(deleted_progress or 0),
            "user_topic_progress": int(deleted_topics or 0),
            "canvas_module_assignment_map": int(deleted_canvas_map or 0),
        },
    }
