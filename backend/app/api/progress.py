from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import verify_token
from app.models.domain_models import Users, UserModuleProgress, UserTopicProgress
from app.models.request_models import QuizResultRequest
from app.services.db import get_session

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


MODULE_NAME_BY_ID: dict[str, str] = {
    "1": "Module 1: Introduction to Computer Architecture",
    "2": "Module 2: MIPS Introduction, ALU and Data Transfer",
    "3": "Module 3: Branch Instructions and Machine Code",
    "4": "Module 4: Functions and Procedures",
    "5": "Module 5: Arrays and Pointers",
}


@router.get("/teacher/modules")
async def teacher_modules(
    db: DbSession,
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    total_students = db.scalar(select(func.count(Users.id))) or 0

    module_ids = list(MODULE_NAME_BY_ID.keys())
    modules: list[dict[str, Any]] = []

    for mid in module_ids:
        module_rows = db.scalars(
            select(UserModuleProgress).where(UserModuleProgress.module_id == mid)
        ).all()
        completed_students = len(module_rows)
        completion_rate = (
            0.0 if total_students == 0 else (100.0 * float(completed_students) / float(total_students))
        )
        avg_score = (
            0.0
            if completed_students == 0
            else (
                sum(float(r.best_score_pct or 0) for r in module_rows) / float(completed_students)
            )
        )

        modules.append(
            {
                "moduleName": MODULE_NAME_BY_ID[mid],
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
    userid: str = Depends(verify_token),
) -> dict[str, Any]:
    module_name = MODULE_NAME_BY_ID.get(str(module_id), f"Module {module_id}")

    all_users = db.scalars(select(Users)).all()
    progress_rows = db.scalars(
        select(UserModuleProgress).where(UserModuleProgress.module_id == str(module_id))
    ).all()
    by_userid: dict[str, UserModuleProgress] = {r.userid: r for r in progress_rows}

    students: list[dict[str, Any]] = []
    for u in all_users:
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
        "totalStudents": len(all_users),
        "students": students,
    }
