from datetime import datetime, timedelta
from typing import Optional

import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models.domain_models import Users
from app.models.request_models import Token


SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


class AuthService:
    def __init__(self, pwd_context: CryptContext | None = None) -> None:
        self.pwd_context = pwd_context or CryptContext(schemes=["bcrypt"], deprecated="auto")

    def hash_password(self, password: str) -> str:
        return self.pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return self.pwd_context.verify(plain_password, hashed_password)

    def create_access_token(
        self, subject: str, expires_delta: Optional[timedelta] = None
    ) -> Token:
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
        payload = {"sub": subject, "exp": expire}
        encoded = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return Token(access_token=encoded)

    def register_user(
        self,
        db: Session,
        userid: str,
        password: str,
        *,
        email: str | None = None,
        sis_user_id: str | None = None,
        role: str | None = None,
        professor_name: str | None = None,
        student_journey: str | None = None,
        student_track: str | None = None,
    ) -> None:
        user = Users(
            userid=userid,
            email=email,
            sis_user_id=sis_user_id,
            role=role,
            professor_name=professor_name,
            student_journey=student_journey,
            student_track=student_track,
            hashed_password=self.hash_password(password),
        )
        db.add(user)
        db.commit()

    def authenticate_user(self, db: Session, userid: str, password: str) -> bool:
        user: Users | None = (
            db.query(Users)
            .where(Users.userid == userid)
            .one_or_none()
        )
        if not user:
            return False
        return self.verify_password(password, user.hashed_password)