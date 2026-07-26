"""Add ON DELETE CASCADE from plan_days and plan_weeks to workout_plans

Revision ID: add_plan_cascade_delete_001
Revises: add_exercise_name_uniqueness_001
Create Date: 2026-07-23 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_plan_cascade_delete_001'
down_revision = 'add_exercise_name_uniqueness_001'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('plan_days_workout_plan_id_fkey', 'plan_days', type_='foreignkey')
    op.create_foreign_key(
        'plan_days_workout_plan_id_fkey',
        'plan_days',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.drop_constraint('plan_weeks_workout_plan_id_fkey', 'plan_weeks', type_='foreignkey')
    op.create_foreign_key(
        'plan_weeks_workout_plan_id_fkey',
        'plan_weeks',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    op.drop_constraint('plan_weeks_workout_plan_id_fkey', 'plan_weeks', type_='foreignkey')
    op.create_foreign_key(
        'plan_weeks_workout_plan_id_fkey',
        'plan_weeks',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
    )
    op.drop_constraint('plan_days_workout_plan_id_fkey', 'plan_days', type_='foreignkey')
    op.create_foreign_key(
        'plan_days_workout_plan_id_fkey',
        'plan_days',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
    )
