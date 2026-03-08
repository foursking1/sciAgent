"""
DataSource model definition.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from backend.db.database import Base


class DataSource(Base):
    """
    DataSource model for user-level data sources.

    Attributes:
        id: Primary key (auto-increment)
        user_id: Foreign key to User
        name: Data source name
        type: Type of data source ('database', 'vector_store', 'skill')
        config: JSON configuration for the data source
        description: Optional description
        is_active: Whether the data source is active
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
        user: Relationship to User
    """
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    config: Mapped[dict] = mapped_column(JSON, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    user: Mapped["User"] = relationship("User", back_populates="data_sources")

    def __repr__(self) -> str:
        return f"<DataSource(id={self.id}, name={self.name}, type={self.type})>"
