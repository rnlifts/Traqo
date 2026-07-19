"""Add target_sets, target_reps, target_weight to workout_exercises

Revision ID: add_targets_001
Revises: add_sessions_001
Create Date: 2026-07-19 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_targets_001'
down_revision = 'add_sessions_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('workout_exercises', sa.Column('target_sets', sa.Integer(), nullable=True))
    op.add_column('workout_exercises', sa.Column('target_reps', sa.Integer(), nullable=True))
    op.add_column('workout_exercises', sa.Column('target_weight', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('workout_exercises', 'target_weight')
    op.drop_column('workout_exercises', 'target_reps')
    op.drop_column('workout_exercises', 'target_sets')
