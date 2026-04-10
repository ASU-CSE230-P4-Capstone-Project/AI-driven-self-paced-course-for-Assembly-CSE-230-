"""
Canvas data for the instructor UI. Protected by JWT; Canvas token stays on the server.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
import httpx

from app.api.auth import verify_token
from app.services import canvas_service

router = APIRouter(tags=["canvas"])


def _aggregate_summaries(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rows:
        return {
            "totalStudents": 0,
            "totalPageViews": 0,
            "totalParticipations": 0,
            "avgPageViews": 0.0,
            "avgParticipations": 0.0,
        }
    total_pv = 0
    total_part = 0
    for r in rows:
        try:
            total_pv += int(r.get("page_views") or 0)
        except (TypeError, ValueError):
            pass
        try:
            total_part += int(r.get("participations") or 0)
        except (TypeError, ValueError):
            pass
    n = len(rows)
    return {
        "totalStudents": n,
        "totalPageViews": total_pv,
        "totalParticipations": total_part,
        "avgPageViews": round(total_pv / n, 1) if n else 0.0,
        "avgParticipations": round(total_part / n, 1) if n else 0.0,
    }


@router.get("/teacher/summary")
async def teacher_canvas_summary(_userid: str = Depends(verify_token)) -> Dict[str, Any]:
    """
    Aggregated Canvas analytics for COURSE_ID, for the teacher dashboard.
    """
    try:
        course_name = await canvas_service.fetch_course_name()
        summaries: List[Dict[str, Any]] = []
        source = "canvas_enrollment_only"
        try:
            summaries = await canvas_service.fetch_student_summaries()
            source = "canvas_analytics_student_summaries"
        except httpx.HTTPStatusError as e:
            # Analytics often 403/404 if disabled or not a teacher token.
            if e.response.status_code not in (403, 404):
                raise
        agg = _aggregate_summaries(summaries)

        modules_count = 0
        try:
            modules_count = await canvas_service.count_modules()
        except Exception:
            pass

        if agg["totalStudents"] == 0:
            try:
                enrollment_count = await canvas_service.count_students_enrollment()
                agg["totalStudents"] = enrollment_count
            except Exception:
                pass

        return {
            "courseName": course_name,
            "canvas": {
                **agg,
                "moduleCount": modules_count,
                "source": source,
            },
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except httpx.HTTPStatusError as e:
        detail = f"Canvas API error: {e.response.status_code}"
        try:
            body = e.response.text[:500]
            if body:
                detail = f"{detail} — {body}"
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from e
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Canvas: {e!s}",
        ) from e


def _merge_students_and_summaries(
    users: List[Dict[str, Any]],
    summaries: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    by_id: Dict[str, Dict[str, int]] = {}
    for s in summaries:
        uid = s.get("id")
        if uid is None:
            continue
        key = str(uid)
        try:
            pv = int(s.get("page_views") or 0)
        except (TypeError, ValueError):
            pv = 0
        try:
            pt = int(s.get("participations") or 0)
        except (TypeError, ValueError):
            pt = 0
        by_id[key] = {"pageViews": pv, "participations": pt}

    covered: set[str] = set()
    rows: List[Dict[str, Any]] = []
    for u in users:
        uid = str(u.get("id", ""))
        if not uid:
            continue
        covered.add(uid)
        metrics = by_id.get(uid, {"pageViews": 0, "participations": 0})
        name = u.get("name") or u.get("sortable_name") or f"User {uid}"
        rows.append(
            {
                "id": uid,
                "name": str(name),
                "pageViews": metrics["pageViews"],
                "participations": metrics["participations"],
            }
        )

    # Summaries may include users not returned in the roster call (pagination / timing).
    for s in summaries:
        uid = s.get("id")
        if uid is None:
            continue
        key = str(uid)
        if key in covered:
            continue
        try:
            pv = int(s.get("page_views") or 0)
        except (TypeError, ValueError):
            pv = 0
        try:
            pt = int(s.get("participations") or 0)
        except (TypeError, ValueError):
            pt = 0
        rows.append(
            {
                "id": key,
                "name": f"User {key}",
                "pageViews": pv,
                "participations": pt,
            }
        )
    return rows


@router.get("/teacher/students")
async def teacher_student_analytics(_userid: str = Depends(verify_token)) -> Dict[str, Any]:
    """
    Per-student Canvas analytics (page views + participations) merged with roster names.
    """
    try:
        summaries: List[Dict[str, Any]] = []
        source = "canvas_enrollment_only"
        try:
            summaries = await canvas_service.fetch_student_summaries()
            source = "canvas_analytics_student_summaries"
        except httpx.HTTPStatusError as e:
            if e.response.status_code not in (403, 404):
                raise

        users: List[Dict[str, Any]] = []
        try:
            users = await canvas_service.fetch_course_students()
        except Exception:
            users = []

        students = _merge_students_and_summaries(users, summaries)
        return {
            "students": students,
            "source": source,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except httpx.HTTPStatusError as e:
        detail = f"Canvas API error: {e.response.status_code}"
        try:
            body = e.response.text[:500]
            if body:
                detail = f"{detail} — {body}"
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from e
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Canvas: {e!s}",
        ) from e
