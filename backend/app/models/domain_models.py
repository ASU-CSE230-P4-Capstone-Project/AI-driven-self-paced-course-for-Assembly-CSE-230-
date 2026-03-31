
from app.services.db import Base
from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint, func


class Users(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    userid = Column(String, unique=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserModuleProgress(Base):
    """Best mastery quiz score per user per module (persisted for dashboard / review)."""

    __tablename__ = "user_module_progress"
    __table_args__ = (UniqueConstraint("userid", "module_id", name="uq_user_module_progress"),)

    id = Column(Integer, primary_key=True, index=True)
    userid = Column(String, index=True, nullable=False)
    module_id = Column(String, index=True, nullable=False)
    best_score_pct = Column(Float, nullable=False, default=0.0)
    last_score_pct = Column(Float, nullable=False, default=0.0)
    attempts = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserTopicProgress(Base):
    """Per-topic mastery derived from mastery quiz results."""

    __tablename__ = "user_topic_progress"
    __table_args__ = (UniqueConstraint("userid", "module_id", "topic", name="uq_user_topic_progress"),)

    id = Column(Integer, primary_key=True, index=True)
    userid = Column(String, index=True, nullable=False)
    module_id = Column(String, index=True, nullable=False)
    topic = Column(String, index=True, nullable=False)

    best_score_pct = Column(Float, nullable=False, default=0.0)
    last_score_pct = Column(Float, nullable=False, default=0.0)

    best_correct_count = Column(Integer, nullable=False, default=0)
    best_total_count = Column(Integer, nullable=False, default=0)
    last_correct_count = Column(Integer, nullable=False, default=0)
    last_total_count = Column(Integer, nullable=False, default=0)

    attempts = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())