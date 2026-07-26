"""Add target_duration_seconds to workout_exercise_set_targets.

Revision ID: add_set_target_duration_001
Revises: add_set_target_flags_001
Create Date: 2026-07-26

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_set_target_duration_001'
down_revision = 'add_set_target_flags_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('workout_exercise_set_targets', sa.Column('target_duration_seconds', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('workout_exercise_set_targets', 'target_duration_seconds')
