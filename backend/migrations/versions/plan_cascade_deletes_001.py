"""Add CASCADE delete to workout_sessions foreign keys.

workout_sessions references workout_plans, plan_days, and plan_weeks with
plain foreign key constraints (NO ACTION). These need to be CASCADE so that
deleting a plan cascades to its days, weeks, sessions, and sets.

Revision ID: plan_cascade_deletes_001
Revises: add_we_id_to_sets_001
Create Date: 2026-07-27

"""
from alembic import op
import sqlalchemy as sa


revision = 'plan_cascade_deletes_001'
down_revision = 'add_we_id_to_sets_001'
branch_labels = None
depends_on = None


def upgrade():
    # Drop existing FK constraints (NO ACTION)
    op.drop_constraint('workout_sessions_workout_plan_id_fkey', 'workout_sessions', type_='foreignkey')
    op.drop_constraint('workout_sessions_plan_day_id_fkey', 'workout_sessions', type_='foreignkey')
    op.drop_constraint('workout_sessions_plan_week_id_fkey', 'workout_sessions', type_='foreignkey')

    # Recreate with CASCADE
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


def downgrade():
    # Drop CASCADE constraints
    op.drop_constraint('workout_sessions_workout_plan_id_fkey', 'workout_sessions', type_='foreignkey')
    op.drop_constraint('workout_sessions_plan_day_id_fkey', 'workout_sessions', type_='foreignkey')
    op.drop_constraint('workout_sessions_plan_week_id_fkey', 'workout_sessions', type_='foreignkey')

    # Recreate with NO ACTION (original state)
    op.create_foreign_key(
        'workout_sessions_workout_plan_id_fkey',
        'workout_sessions',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
    )
    op.create_foreign_key(
        'workout_sessions_plan_day_id_fkey',
        'workout_sessions',
        'plan_days',
        ['plan_day_id'],
        ['id'],
    )
    op.create_foreign_key(
        'workout_sessions_plan_week_id_fkey',
        'workout_sessions',
        'plan_weeks',
        ['plan_week_id'],
        ['id'],
    )
