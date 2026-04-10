"""
Server-side Canvas REST API client. Uses env vars; never expose USER_ACCESS_TOKEN to the frontend.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import httpx

DEFAULT_TIMEOUT = 30.0


def _base_url() -> str:
    raw = (os.getenv("CANVAS_BASE_URL") or "").strip().rstrip("/")
    if not raw:
        raise ValueError("CANVAS_BASE_URL is not set")
    return raw + "/"


def _access_token() -> str:
    token = (os.getenv("USER_ACCESS_TOKEN") or "").strip()
    if not token:
        raise ValueError("USER_ACCESS_TOKEN is not set")
    return token


def _course_id() -> str:
    cid = (os.getenv("COURSE_ID") or "").strip()
    if not cid:
        raise ValueError("COURSE_ID is not set")
    return cid


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {_access_token()}",
        "Accept": "application/json",
    }


async def canvas_get_json(path: str, *, params: Optional[Dict[str, Any]] = None) -> Any:
    """GET relative to Canvas host, e.g. path='api/v1/courses/123'."""
    url = urljoin(_base_url(), path.lstrip("/"))
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=_headers(), params=params)
        response.raise_for_status()
        return response.json()


async def fetch_course_name(course_id: Optional[str] = None) -> str:
    cid = course_id or _course_id()
    data = await canvas_get_json(f"api/v1/courses/{cid}")
    if isinstance(data, dict):
        name = data.get("name") or data.get("course_code") or ""
        return str(name) if name else f"Course {cid}"
    return f"Course {cid}"


async def fetch_student_summaries(course_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Instructor analytics: per-student engagement (page views, participations, etc.).
    See Canvas REST API: GET /api/v1/courses/:course_id/analytics/student_summaries
    """
    cid = course_id or _course_id()
    data = await canvas_get_json(f"api/v1/courses/{cid}/analytics/student_summaries")
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    return []


async def count_students_enrollment(course_id: Optional[str] = None) -> int:
    """Fallback student count via enrollments (students only)."""
    cid = course_id or _course_id()
    users = await canvas_get_json(
        f"api/v1/courses/{cid}/users",
        params={"enrollment_type[]": "student", "per_page": 100},
    )
    if isinstance(users, list):
        return len(users)
    return 0


async def count_modules(course_id: Optional[str] = None) -> int:
    cid = course_id or _course_id()
    modules = await canvas_get_json(
        f"api/v1/courses/{cid}/modules",
        params={"per_page": 100},
    )
    if isinstance(modules, list):
        return len(modules)
    return 0


async def fetch_course_students(course_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Enrolled students in the course (for names + ids)."""
    cid = course_id or _course_id()
    users = await canvas_get_json(
        f"api/v1/courses/{cid}/users",
        params={"enrollment_type[]": "student", "per_page": 100},
    )
    if isinstance(users, list):
        return [u for u in users if isinstance(u, dict)]
    return []
