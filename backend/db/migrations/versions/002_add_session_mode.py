"""Add current_mode to sessions table

Revision ID: 002_add_session_mode
Revises: 001_initial
Create Date: 2026-03-07

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_add_session_mode"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add current_mode column to sessions table
    op.add_column(
        "sessions",
        sa.Column(
            "current_mode", sa.String(50), nullable=False, server_default="normal"
        ),
    )


def downgrade() -> None:
    # Remove current_mode column from sessions table
    op.drop_column("sessions", "current_mode")
