"""Add missing indexes on frequently-queried foreign key columns

Revision ID: add_missing_indexes_001
Revises: add_plan_weeks_001
Create Date: 2026-07-22 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_missing_indexes_001'
down_revision = 'add_plan_weeks_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_workout_plans_user_id', 'workout_plans', ['user_id'])
    op.create_index('ix_workout_exercises_plan_day_id', 'workout_exercises', ['plan_day_id'])
    op.create_index('ix_plan_days_workout_plan_id', 'plan_days', ['workout_plan_id'])


def downgrade():
    op.drop_index('ix_plan_days_workout_plan_id', table_name='plan_days')
    op.drop_index('ix_workout_exercises_plan_day_id', table_name='workout_exercises')
    op.drop_index('ix_workout_plans_user_id', table_name='workout_plans')
