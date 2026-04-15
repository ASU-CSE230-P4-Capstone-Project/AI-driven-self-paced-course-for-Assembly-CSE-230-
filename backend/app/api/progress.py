from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import require_staff, verify_token
from app.models.domain_models import (
    CanvasModuleAssignmentMap,
    CanvasUserMap,
    Module,
    Users,
    UserModuleProgress,
    UserTopicProgress,
)
from app.models.request_models import QuizResultRequest
from app.services.db import get_session
from app.services.pushback_service import (
    canvas_create_assignment,
    canvas_find_user_id_by_search_term,
    canvas_list_assignments,
)

router = APIRouter(tags=["progress"])
DbSession = Annotated[Session, Depends(get_session)]


def _pct(correct: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return 100.0 * float(correct) / float(total)


@router.post("/quiz-result")
async def record_quiz_result(
    body: QuizResultRequest,
    db: DbSession,
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    if body.score > body.total_questions:
        raise HTTPException(status_code=400, detail="score cannot exceed total_questions")

    module_pct = _pct(body.score, body.total_questions)

    row = db.scalars(
        select(UserModuleProgress).where(
            UserModuleProgress.userid == userid,
            UserModuleProgress.module_id == body.module_id,
        )
    ).first()

    if row is None:
        row = UserModuleProgress(
            userid=userid,
            module_id=body.module_id,
            best_score_pct=module_pct,
            last_score_pct=module_pct,
            attempts=1,
        )
        db.add(row)
    else:
        row.attempts = int(row.attempts or 0) + 1
        row.last_score_pct = module_pct
        if module_pct > float(row.best_score_pct or 0):
            row.best_score_pct = module_pct

    # Topic-level persistence (used by Student Review + Professor analytics)
    for tr in body.topic_results or []:
        topic = (tr.topic or "").strip()
        if not topic:
            continue

        topic_pct = _pct(int(tr.correct), int(tr.total))

        topic_row = db.scalars(
            select(UserTopicProgress).where(
                UserTopicProgress.userid == userid,
                UserTopicProgress.module_id == body.module_id,
                UserTopicProgress.topic == topic,
            )
        ).first()

        if topic_row is None:
            topic_row = UserTopicProgress(
                userid=userid,
                module_id=body.module_id,
                topic=topic,
                best_score_pct=topic_pct,
                last_score_pct=topic_pct,
                best_correct_count=int(tr.correct),
                best_total_count=int(tr.total),
                last_correct_count=int(tr.correct),
                last_total_count=int(tr.total),
                attempts=1,
            )
            db.add(topic_row)
        else:
            topic_row.attempts = int(topic_row.attempts or 0) + 1
            topic_row.last_score_pct = topic_pct
            topic_row.last_correct_count = int(tr.correct)
            topic_row.last_total_count = int(tr.total)
            if topic_pct > float(topic_row.best_score_pct or 0):
                topic_row.best_score_pct = topic_pct
                topic_row.best_correct_count = int(tr.correct)
                topic_row.best_total_count = int(tr.total)

    db.commit()
    db.refresh(row)

    # -----------------------
    # Canvas grade integration (best-effort)
    # -----------------------
    # Map module -> Canvas assignment. Create if missing.
    module_id = str(body.module_id)
    desired_name = f"Mastery Quiz - Chapter {module_id}"

    amap = db.scalars(
        select(CanvasModuleAssignmentMap).where(CanvasModuleAssignmentMap.module_id == module_id)
    ).first()

    if amap is None:
        assignments = await canvas_list_assignments()
        match = next((a for a in assignments if (a.get("name") or "").strip() == desired_name), None)
        if match is None:
            created = await canvas_create_assignment(desired_name)
            match = created

        if match and match.get("id"):
            amap = CanvasModuleAssignmentMap(
                module_id=module_id,
                canvas_assignment_id=int(match["id"]),
                assignment_name=str(match.get("name") or desired_name),
            )
            db.add(amap)
            db.commit()

    # Map app userid -> Canvas user id.
    # Preferred: explicit connect (pushback/connect-me) which inserts CanvasUserMap.
    # Fallback: best-effort roster search by userid (email/login).
    umap = db.scalars(select(CanvasUserMap).where(CanvasUserMap.userid == userid)).first()
    if umap is None:
        found = await canvas_find_user_id_by_search_term(userid)
        if found and found.get("id"):
            umap = CanvasUserMap(
                userid=userid,
                canvas_user_id=int(found["id"]),
                canvas_login_id=str(found.get("login_id") or found.get("sis_user_id") or "") or None,
            )
            db.add(umap)
            db.commit()

    # Push grade if mappings exist.
    if amap is not None and umap is not None:
        posted_grade = str(round(module_pct, 2))
        # Reuse the pushback endpoint logic via direct Canvas call (avoids HTTP round-trip)
        from app.services.pushback_service import push_grade, GradeRequest  # local import to avoid cycles

        await push_grade(
            GradeRequest(
                assignment_id=int(amap.canvas_assignment_id),
                user_id=int(umap.canvas_user_id),
                posted_grade=posted_grade,
            )
        )

    return {
        "module_id": body.module_id,
        "best_score_pct": float(row.best_score_pct or 0),
        "last_score_pct": float(row.last_score_pct or 0),
        "attempts": int(row.attempts or 0),
    }


@router.get("/me")
async def get_my_progress(
    db: DbSession,
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    module_rows = db.scalars(
        select(UserModuleProgress).where(UserModuleProgress.userid == userid)
    ).all()

    modules: dict[str, dict[str, Any]] = {}
    for r in module_rows:
        modules[r.module_id] = {
            "best_score_pct": float(r.best_score_pct or 0),
            "last_score_pct": float(r.last_score_pct or 0),
            "attempts": int(r.attempts or 0),
            "topics": {},
        }

    topic_rows = db.scalars(
        select(UserTopicProgress).where(UserTopicProgress.userid == userid)
    ).all()

    for tr in topic_rows:
        mod = modules.setdefault(
            tr.module_id,
            {
                "best_score_pct": 0.0,
                "last_score_pct": 0.0,
                "attempts": 0,
                "topics": {},
            },
        )
        mod_topics = mod.setdefault("topics", {})
        mod_topics[tr.topic] = {
            "best_score_pct": float(tr.best_score_pct or 0),
            "last_score_pct": float(tr.last_score_pct or 0),
            "best_correct_count": int(tr.best_correct_count or 0),
            "best_total_count": int(tr.best_total_count or 0),
            "last_correct_count": int(tr.last_correct_count or 0),
            "last_total_count": int(tr.last_total_count or 0),
            "attempts": int(tr.attempts or 0),
        }

    return {"userid": userid, "modules": modules}


def _grade_from_pct(pct: float) -> str:
    if pct >= 85:
        return "A"
    if pct >= 70:
        return "B"
    if pct >= 50:
        return "C"
    if pct > 0:
        return "D"
    return "Not attempted"


def _label_module(mid: int, title: str) -> str:
    t = (title or "").strip()
    if not t:
        return f"Module {mid}"
    if t.lower().startswith("module "):
        return t
    return f"Module {mid}: {t}"


_ROSTER_EXCLUDE_ROLES = frozenset({"staff", "professor", "teacher", "ta"})


def _is_roster_student(user: Users) -> bool:
    """Staff and instructor roles are excluded from student rosters and class-size metrics."""
    r = (user.role or "").strip().lower()
    return r not in _ROSTER_EXCLUDE_ROLES


@router.get("/teacher/modules")
async def teacher_modules(
    db: DbSession,
    _: str = Depends(require_staff),
) -> dict[str, Any]:
    all_users = db.scalars(select(Users)).all()
    student_userids = {u.userid for u in all_users if u.userid and _is_roster_student(u)}
    total_students = len(student_userids)

    module_rows = db.scalars(select(Module).order_by(Module.id.asc())).all()
    modules: list[dict[str, Any]] = []

    for m in module_rows:
        mid = str(m.id)
        progress_rows = db.scalars(
            select(UserModuleProgress).where(UserModuleProgress.module_id == mid)
        ).all()
        student_progress = [r for r in progress_rows if r.userid in student_userids]
        completed_students = len(student_progress)
        completion_rate = (
            0.0 if total_students == 0 else (100.0 * float(completed_students) / float(total_students))
        )
        avg_score = (
            0.0
            if completed_students == 0
            else (
                sum(float(r.best_score_pct or 0) for r in student_progress) / float(completed_students)
            )
        )

        modules.append(
            {
                "moduleId": mid,
                "moduleName": _label_module(int(m.id), str(m.title)),
                "questions": [],
                "completedStudents": completed_students,
                "totalStudents": total_students,
                "completionRate": round(completion_rate),
                "averageScore": round(avg_score),
            }
        )

    return {"totalStudents": total_students, "modules": modules}


@router.get("/teacher/module-students")
async def teacher_module_students(
    module_id: str,
    db: DbSession,
    _: str = Depends(require_staff),
) -> dict[str, Any]:
    m = db.scalars(select(Module).where(Module.id == int(module_id))).first()
    module_name = _label_module(int(module_id), str(m.title) if m else "")

    all_users = db.scalars(select(Users)).all()
    progress_rows = db.scalars(
        select(UserModuleProgress).where(UserModuleProgress.module_id == str(module_id))
    ).all()
    by_userid: dict[str, UserModuleProgress] = {r.userid: r for r in progress_rows}

    roster_users = [u for u in all_users if u.userid and _is_roster_student(u)]

    students: list[dict[str, Any]] = []
    for u in roster_users:
        r = by_userid.get(u.userid)
        best = float(r.best_score_pct or 0) if r else 0.0
        last = float(r.last_score_pct or 0) if r else 0.0
        attempts = int(r.attempts or 0) if r else 0
        students.append(
            {
                "userid": u.userid,
                "best_score_pct": best,
                "last_score_pct": last,
                "attempts": attempts,
                "grade": _grade_from_pct(best),
            }
        )

    students.sort(
        key=lambda s: float(s.get("best_score_pct") or 0),
        reverse=True,
    )

    return {
        "moduleId": str(module_id),
        "moduleName": module_name,
        "totalStudents": len(roster_users),
        "students": students,
    }
