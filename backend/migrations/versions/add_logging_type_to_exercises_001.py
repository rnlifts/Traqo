"""Add logging_type to exercises, backfilled to weight_reps for all existing rows

Revision ID: add_logging_type_to_exercises_001
Revises: add_is_quick_start_to_plans_001
Create Date: 2026-07-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_logging_type_001'
down_revision = 'add_is_quick_start_to_plans_001'
branch_labels = None
depends_on = None


def upgrade():
    # server_default backfills every existing exercise to 'weight_reps', which is exactly
    # the behavior they already had before this column existed.
    op.add_column(
        'exercises',
        sa.Column('logging_type', sa.String(20), nullable=False, server_default='weight_reps'),
    )


def downgrade():
    op.drop_column('exercises', 'logging_type')
