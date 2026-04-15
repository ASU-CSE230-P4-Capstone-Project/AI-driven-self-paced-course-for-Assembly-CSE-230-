
from app.services.db import Base
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func


class Users(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    userid = Column(String, unique=True)
    email = Column(String, unique=True, nullable=True)
    sis_user_id = Column(String, unique=True, nullable=True)
    role = Column(String, nullable=True)
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


class CanvasUserMap(Base):
    """
    Map our app's userid (JWT sub; typically an email/username) to a Canvas numeric user_id.
    """

    __tablename__ = "canvas_user_map"
    __table_args__ = (UniqueConstraint("userid", name="uq_canvas_user_map_userid"),)

    id = Column(Integer, primary_key=True, index=True)
    userid = Column(String, index=True, nullable=False)
    canvas_user_id = Column(Integer, index=True, nullable=False)
    canvas_login_id = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CanvasModuleAssignmentMap(Base):
    """
    Map a module_id to a Canvas assignment_id (for mastery quiz grade posting).
    """

    __tablename__ = "canvas_module_assignment_map"
    __table_args__ = (UniqueConstraint("module_id", name="uq_canvas_module_assignment_module"),)

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(String, index=True, nullable=False)
    canvas_assignment_id = Column(Integer, index=True, nullable=False)
    assignment_name = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Module(Base):
    __tablename__ = "modules"

    # Keep module IDs stable (1..N) to match current routes/module_id usage.
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False, default="")
    is_published = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ModuleResource(Base):
    __tablename__ = "module_resources"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), index=True, nullable=False)
    kind = Column(String, nullable=False)  # reading | video
    title = Column(String, nullable=False)
    duration = Column(String, nullable=False, default="")
    url = Column(String, nullable=True)
    content_markdown = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())