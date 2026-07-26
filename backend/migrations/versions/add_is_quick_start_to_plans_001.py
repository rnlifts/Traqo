"""Add is_quick_start flag to workout_plans, with best-effort backfill

Revision ID: add_is_quick_start_to_plans_001
Revises: add_plan_cascade_delete_001
Create Date: 2026-07-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_is_quick_start_to_plans_001'
down_revision = 'add_plan_cascade_delete_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'workout_plans',
        sa.Column('is_quick_start', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Best-effort backfill: existing quick-start plans were only identifiable by name
    # prefix before this flag existed. This is a heuristic, not a guarantee — any plan
    # a user happened to name starting with "Quick Workout -" will also match.
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE workout_plans
            SET is_quick_start = TRUE
            WHERE name LIKE 'Quick Workout - %'
        """)
    )


def downgrade():
    op.drop_column('workout_plans', 'is_quick_start')
