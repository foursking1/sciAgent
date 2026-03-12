"""
Session Event model definition.

Stores all SSE event types for session history reconstruction.
"""

from __future__ import annotations

from datetime import datetime

from backend.db.database import Base
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class SessionEventType:
    """Enum for session event types"""

    USER_MESSAGE = "user_message"
    MESSAGE = "message"
    FUNCTION_CALL = "function_call"
    FUNCTION_RESPONSE = "function_response"
    STARTED = "started"
    STATUS = "status"
    USAGE = "usage"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


class SessionEvent(Base):
    """
    Session Event model for storing all SSE events.

    This model stores all event types from the agent execution,
    enabling complete session history reconstruction on page refresh.

    Attributes:
        id: Primary key
        session_id: Foreign key to Session (UUID string)
        event_type: Type of event (user_message, message, function_call, etc.)
        event_data: Full event data as JSON (preserves all event fields)
        created_at: Timestamp of event creation
        session: Relationship to Session
    """

    __tablename__ = "session_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    event_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationships
    session: Mapped["Session"] = relationship("Session", back_populates="events")

    def __repr__(self) -> str:
        return (
            f"<SessionEvent(id={self.id}, session_id={self.session_id}, event_type={self.event_type})>"
        )

    def to_event_dict(self) -> dict:
        """
        Convert to event dictionary format compatible with SSE.

        Returns the event_data with timestamp from created_at if not present.
        """
        event = dict(self.event_data)
        # Ensure timestamp exists
        if "timestamp" not in event:
            event["timestamp"] = self.created_at.isoformat()
        return event
