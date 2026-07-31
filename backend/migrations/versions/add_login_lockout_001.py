"""Add per-account login lockout tracking

Revision ID: add_login_lockout_001
Revises: exercises_is_custom_001
Create Date: 2026-07-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_login_lockout_001'
down_revision = 'exercises_is_custom_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add failed_login_attempts column (not null, default 0)
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))

    # Add locked_until column (nullable timestamp)
    op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Drop the columns
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
