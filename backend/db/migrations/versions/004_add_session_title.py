"""Add title field to sessions table

Revision ID: 004
Revises: 003
Create Date: 2026-03-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('title', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('sessions', 'title')
