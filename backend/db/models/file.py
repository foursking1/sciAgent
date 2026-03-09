"""
File model definition.
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from backend.db.database import Base


class File(Base):
    """
    File model for tracking files uploaded/created in sessions.

    Attributes:
        id: Primary key
        session_id: Foreign key to Session (UUID string)
        filename: Original filename
        file_path: Full path to the file
        file_size: Size in bytes
        content_type: MIME type of the file
        created_at: Timestamp of file record creation
        session: Relationship to Session
    """
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    session: Mapped["Session"] = relationship("Session", back_populates="files")

    def __repr__(self) -> str:
        return f"<File(id={self.id}, filename={self.filename})>"
