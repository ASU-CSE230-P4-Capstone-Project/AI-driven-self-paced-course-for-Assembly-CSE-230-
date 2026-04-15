from datetime import timedelta
from typing import Annotated
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.models.request_models import Token, UserCreate, UserLogin, UserResponse
from app.models.domain_models import Users
from app.services.auth_service import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    AuthService,
    SECRET_KEY,
)
from app.services.db import get_session

router = APIRouter(tags=["auth"])
security = HTTPBearer()
auth_service = AuthService()
db_dependency = Annotated[Session, Depends(get_session)]

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired") from exc
    except jwt.DecodeError as exc:
        raise HTTPException(status_code=401, detail="Could not validate credentials") from exc

    userid = payload.get("sub")
    if userid is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return userid


def _role_for_user(db: Session, userid: str) -> str:
    u = db.query(Users).where(Users.userid == userid).one_or_none()
    if not u:
        # Token subject should always exist, but avoid leaking details.
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return (u.role or "student").strip().lower() or "student"


def require_staff(
    db: db_dependency,
    userid: str = Depends(verify_token),
) -> str:
    """
    Teacher/staff-only guard.
    This is the authoritative check (DB-backed), not localStorage/front-end.
    """
    role = _role_for_user(db, userid)
    if role != "staff":
        raise HTTPException(status_code=403, detail="Not authorized")
    return userid


@router.post("/signup", response_model=UserResponse)
async def signup(user: UserCreate, db: db_dependency) -> UserResponse:
    email = (user.email or "").strip().lower()
    sis = (user.sis_user_id or "").strip()
    role = (user.role or "student").strip().lower()
    professor_name = (user.professor_name or "").strip() or None
    student_journey = (user.student_journey or "").strip().lower() or None
    student_track = (user.student_track or "").strip().lower() or None

    if not email.endswith("@asu.edu"):
        raise HTTPException(status_code=400, detail="Email must be an official ASU email (@asu.edu).")
    if not sis.isdigit() or len(sis) != 10:
        raise HTTPException(status_code=400, detail="SIS ID must be a 10-digit number.")

    # Roles: student / staff. We accept professor + ta for UI friendliness,
    # but normalize to staff for consistency.
    if role not in ("student", "staff", "professor", "ta"):
        raise HTTPException(status_code=400, detail="Invalid role.")
    if role in ("staff", "professor", "ta"):
        role = "staff"

    # Prefer email as the stable userid used for auth/JWT
    userid = email

    existing = db.query(Users).where((Users.userid == userid) | (Users.email == email) | (Users.sis_user_id == sis)).one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    auth_service.register_user(
        db,
        userid,
        user.password,
        email=email,
        sis_user_id=sis,
        role=role,
        professor_name=professor_name,
        student_journey=student_journey,
        student_track=student_track,
    )
    return UserResponse(userid=userid, message="User created successfully")


@router.post("/login", response_model=Token)
async def login(user: UserLogin, db: db_dependency) -> Token:
    userid = (user.userid or "").strip().lower()
    if not userid:
        raise HTTPException(status_code=400, detail="userid is required")
    if not auth_service.authenticate_user(db, userid, user.password):
        raise HTTPException(status_code=401, detail="Incorrect userid or password")
    return auth_service.create_access_token(
        subject=userid,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

# you can use it by typing the token which you got from the login endpoint
@router.get("/protected", response_model=UserResponse)
async def protected_route(userid: str = Depends(verify_token)) -> UserResponse:
    return UserResponse(userid=userid, message=f"Hello {userid}! This is a protected route.")


@router.get("/users/me", response_model=UserResponse)
async def read_users_me(userid: str = Depends(verify_token)) -> UserResponse:
    return UserResponse(userid=userid, message=f"Current user: {userid}")


@router.get("/me")
async def auth_me(
    db: db_dependency,
    userid: str = Depends(verify_token),
) -> dict[str, str]:
    u = db.query(Users).where(Users.userid == userid).one_or_none()
    if not u:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return {
        "userid": str(u.userid),
        "email": str(u.email or u.userid or ""),
        "role": (u.role or "student").strip().lower() or "student",
    }