"""
User model definition.
"""

from __future__ import annotations

from datetime import datetime

from backend.db.database import Base
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class User(Base):
    """
    User model for authentication and authorization.

    Attributes:
        id: Primary key
        email: Unique email address for login
        password_hash: Hashed password (never store plain text)
        full_name: Optional display name
        is_active: Account status (default True)
        created_at: Timestamp of account creation
        updated_at: Timestamp of last update
        sessions: Relationship to Session records
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    data_sources: Mapped[list["DataSource"]] = relationship(
        "DataSource", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
