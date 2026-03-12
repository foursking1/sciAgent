"""
Message model definition.
"""

from __future__ import annotations

from datetime import datetime

from backend.db.database import Base
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class MessageRole:
    """Enum for message roles"""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(Base):
    """
    Message model for chat history within sessions.

    Attributes:
        id: Primary key
        session_id: Foreign key to Session (UUID string)
        content: Message content text
        role: Role of the message sender (user/assistant/system)
        created_at: Timestamp of message creation
        session: Relationship to Session
    """

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=MessageRole.USER)
    is_stopped: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    session: Mapped["Session"] = relationship("Session", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, session_id={self.session_id}, role={self.role})>"
