"""Add is_custom flag to exercises table and backfill from library items.

Adds a boolean is_custom column to track whether an exercise was created
by the user or auto-created as a side effect of adding a library item to a plan.

The backfill marks exercises as is_custom=false if they:
- Have a name that case-insensitively matches an exercise_library_items.name
- AND have null muscle_group, equipment, and video_url (the pollution signature)

This cleans up existing pollution without deleting any data.

Revision ID: exercises_is_custom_001
Revises: plan_cascade_deletes_001
Create Date: 2026-07-31

"""
from alembic import op
import sqlalchemy as sa


revision = 'exercises_is_custom_001'
down_revision = 'add_exercise_metadata_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_custom column with default true
    op.add_column(
        'exercises',
        sa.Column('is_custom', sa.Boolean(), server_default=sa.true(), nullable=False)
    )

    # Backfill: mark exercises as is_custom=false if they match library items
    # exactly (case-insensitive) and have all-null metadata
    op.execute("""
        UPDATE exercises e
        SET is_custom = false
        FROM exercise_library_items lib
        WHERE LOWER(e.name) = LOWER(lib.name)
          AND e.muscle_group IS NULL
          AND e.equipment IS NULL
          AND e.video_url IS NULL
    """)


def downgrade():
    # Drop the is_custom column
    op.drop_column('exercises', 'is_custom')
