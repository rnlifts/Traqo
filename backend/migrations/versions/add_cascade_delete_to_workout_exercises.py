"""Add cascade delete to workout_exercises foreign key

Revision ID: cascade_delete_001
Revises: a871d2efa9ac
Create Date: 2026-07-18 20:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cascade_delete_001'
down_revision = 'a871d2efa9ac'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the existing foreign key constraint
    op.drop_constraint('workout_exercises_workout_plan_id_fkey', 'workout_exercises', type_='foreignkey')

    # Recreate it with ON DELETE CASCADE
    op.create_foreign_key(
        'workout_exercises_workout_plan_id_fkey',
        'workout_exercises',
        'workout_plans',
        ['workout_plan_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade():
    # Drop the cascade constraint
    op.drop_constraint('workout_exercises_workout_plan_id_fkey', 'workout_exercises', type_='foreignkey')

    # Recreate without cascade
    op.create_foreign_key(
        'workout_exercises_workout_plan_id_fkey',
        'workout_exercises',
        'workout_plans',
        ['workout_plan_id'],
        ['id']
    )
