"""Add session_events table for storing all SSE event types

Revision ID: 007_add_session_events
Revises: 006_add_session_is_public
Create Date: 2026-03-12

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007_add_session_events"
down_revision: Union[str, None] = "006_add_session_is_public"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create session_events table
    op.create_table(
        "session_events",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "session_id",
            sa.String(100),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_type",
            sa.String(50),
            nullable=False,
        ),
        sa.Column(
            "event_data",
            sa.JSON(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # Indexes
        sa.Index("ix_session_events_session_id", "session_id"),
        sa.Index("ix_session_events_event_type", "event_type"),
        sa.Index("ix_session_events_created_at", "created_at"),
        # Primary key
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("session_events")
