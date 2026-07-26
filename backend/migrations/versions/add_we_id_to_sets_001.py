"""Add workout_exercise_id to workout_sets.

This column was added to local dev databases via an out-of-band script at
some point and was never captured as a proper migration, so it never
existed in any environment that only ran `alembic upgrade head` (e.g.
production). This migration brings the schema in line with what
WorkoutSetModel has always expected.

Revision ID: add_we_id_to_sets_001
Revises: add_set_target_duration_001
Create Date: 2026-07-26

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_we_id_to_sets_001'
down_revision = 'add_set_target_duration_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'workout_sets',
        sa.Column('workout_exercise_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_workout_sets_workout_exercise_id',
        'workout_sets',
        'workout_exercises',
        ['workout_exercise_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    op.drop_constraint('fk_workout_sets_workout_exercise_id', 'workout_sets', type_='foreignkey')
    op.drop_column('workout_sets', 'workout_exercise_id')
