"""
Session model definition.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from backend.db.database import Base


class Session(Base):
    """
    Session model for tracking user analysis sessions.

    Attributes:
        id: Primary key (unique session identifier)
        user_id: Foreign key to User
        working_dir: Working directory path for the session
        title: Session title (first user message)
        agent_type: Type of agent used (e.g., 'claude_code')
        current_mode: Current session mode ('data-question', 'scientific-experiment', 'data-extraction', 'paper-writing')
        created_at: Timestamp of session creation
        updated_at: Timestamp of last update
        user: Relationship to User
        messages: Relationship to Message records
        files: Relationship to File records
    """
    __tablename__ = "sessions"
    __allow_unmapped__ = True  # Allow non-mapped attributes like preview

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    working_dir: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    agent_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_mode: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="data-question",
        server_default="data-question"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    files: Mapped[list["File"]] = relationship(
        "File",
        back_populates="session",
        cascade="all, delete-orphan"
    )

    # Non-persisted attribute for last message preview
    preview: Optional[str] = None

    def __repr__(self) -> str:
        return f"<Session(id={self.id}, user_id={self.user_id})>"
