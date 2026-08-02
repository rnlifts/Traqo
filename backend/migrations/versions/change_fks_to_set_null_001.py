"""Preserve logged history on plan/exercise delete - change CASCADE to SET NULL.

Changes foreign keys from CASCADE to SET NULL so that deleting a plan or exercise
preserves the user's logged workout history (sessions and sets), just detached from
the now-deleted plan/exercise. Also makes workout_sessions.workout_plan_id nullable
since it will be NULL after the corresponding plan is deleted.

Revision ID: change_fks_to_set_null_001
Revises: add_login_lockout_001
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'change_fks_to_set_null_001'
down_revision = 'add_login_lockout_001'
branch_labels = None
depends_on = None


def _get_fk_constraint_name(table_name: str, column_name: str) -> str | None:
    """Dynamically look up the actual FK constraint name for a given column."""
    bind = op.get_bind()
    inspector = inspect(bind)
    foreign_keys = inspector.get_foreign_keys(table_name)
    for fk in foreign_keys:
        # inspector.get_foreign_keys() returns constrained_columns as a list, not tuple
        if column_name in fk['constrained_columns']:
            return fk['name']
    return None


def upgrade():
    # Make workout_sessions.workout_plan_id nullable
    op.alter_column('workout_sessions', 'workout_plan_id',
                   existing_type=sa.Integer(),
                   nullable=True)

    # Dynamically discover and drop existing CASCADE FK constraints
    # (constraint names can vary between environments due to historical drift)
    fk_workout_plan = _get_fk_constraint_name('workout_sessions', 'workout_plan_id')
    if fk_workout_plan:
        op.drop_constraint(fk_workout_plan, 'workout_sessions', type_='foreignkey')

    fk_plan_day = _get_fk_constraint_name('workout_sessions', 'plan_day_id')
    if fk_plan_day:
        op.drop_constraint(fk_plan_day, 'workout_sessions', type_='foreignkey')

    fk_plan_week = _get_fk_constraint_name('workout_sessions', 'plan_week_id')
    if fk_plan_week:
        op.drop_constraint(fk_plan_week, 'workout_sessions', type_='foreignkey')

    fk_workout_exercise = _get_fk_constraint_name('workout_sets', 'workout_exercise_id')
    if fk_workout_exercise:
        op.drop_constraint(fk_workout_exercise, 'workout_sets', type_='foreignkey')

    # Recreate with SET NULL
    op.create_foreign_key(
        'workout_sessions_workout_plan_id_fkey',
        'workout_sessions',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'workout_sessions_plan_day_id_fkey',
        'workout_sessions',
        'plan_days',
        ['plan_day_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'workout_sessions_plan_week_id_fkey',
        'workout_sessions',
        'plan_weeks',
        ['plan_week_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_foreign_key(
        'workout_sets_workout_exercise_id_fkey',
        'workout_sets',
        'workout_exercises',
        ['workout_exercise_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade():
    # Revert workout_sessions.workout_plan_id to non-nullable
    op.alter_column('workout_sessions', 'workout_plan_id',
                   existing_type=sa.Integer(),
                   nullable=False)

    # Dynamically discover and drop SET NULL constraints
    fk_workout_plan = _get_fk_constraint_name('workout_sessions', 'workout_plan_id')
    if fk_workout_plan:
        op.drop_constraint(fk_workout_plan, 'workout_sessions', type_='foreignkey')

    fk_plan_day = _get_fk_constraint_name('workout_sessions', 'plan_day_id')
    if fk_plan_day:
        op.drop_constraint(fk_plan_day, 'workout_sessions', type_='foreignkey')

    fk_plan_week = _get_fk_constraint_name('workout_sessions', 'plan_week_id')
    if fk_plan_week:
        op.drop_constraint(fk_plan_week, 'workout_sessions', type_='foreignkey')

    fk_workout_exercise = _get_fk_constraint_name('workout_sets', 'workout_exercise_id')
    if fk_workout_exercise:
        op.drop_constraint(fk_workout_exercise, 'workout_sets', type_='foreignkey')

    # Recreate with CASCADE (original state)
    op.create_foreign_key(
        'workout_sessions_workout_plan_id_fkey',
        'workout_sessions',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'workout_sessions_plan_day_id_fkey',
        'workout_sessions',
        'plan_days',
        ['plan_day_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'workout_sessions_plan_week_id_fkey',
        'workout_sessions',
        'plan_weeks',
        ['plan_week_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'workout_sets_workout_exercise_id_fkey',
        'workout_sets',
        'workout_exercises',
        ['workout_exercise_id'],
        ['id'],
        ondelete='CASCADE',
    )
