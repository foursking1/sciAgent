"""Update session mode to new values

Revision ID: 005_update_session_mode
Revises: 004_add_session_title
Create Date: 2026-03-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_update_session_mode'
down_revision: Union[str, None] = '004_add_session_title'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update existing mode values to new ones
    # normal -> data-question
    # research -> scientific-experiment
    op.execute(
        "UPDATE sessions SET current_mode = 'data-question' WHERE current_mode = 'normal'"
    )
    op.execute(
        "UPDATE sessions SET current_mode = 'scientific-experiment' WHERE current_mode = 'research'"
    )

    # Update server_default to new value
    op.alter_column(
        'sessions',
        'current_mode',
        server_default='data-question'
    )


def downgrade() -> None:
    # Revert mode values to old ones
    op.execute(
        "UPDATE sessions SET current_mode = 'normal' WHERE current_mode = 'data-question'"
    )
    op.execute(
        "UPDATE sessions SET current_mode = 'research' WHERE current_mode = 'scientific-experiment'"
    )

    # Revert server_default
    op.alter_column(
        'sessions',
        'current_mode',
        server_default='normal'
    )
