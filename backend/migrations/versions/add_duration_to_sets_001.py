"""Add duration_seconds and make weight/reps optional in workout_sets.

Revision ID: add_duration_to_sets_001
Revises: add_logging_type_001
Create Date: 2026-07-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_duration_to_sets_001'
down_revision = 'add_logging_type_001'
branch_labels = None
depends_on = None


def upgrade():
    # Make weight nullable
    op.alter_column('workout_sets', 'weight',
               existing_type=sa.Float(),
               nullable=True,
               existing_nullable=False)

    # Make reps nullable
    op.alter_column('workout_sets', 'reps',
               existing_type=sa.Integer(),
               nullable=True,
               existing_nullable=False)

    # Add duration_seconds column
    op.add_column('workout_sets', sa.Column('duration_seconds', sa.Integer(), nullable=True))


def downgrade():
    # Remove duration_seconds column
    op.drop_column('workout_sets', 'duration_seconds')

    # Revert weight back to NOT NULL
    op.alter_column('workout_sets', 'weight',
               existing_type=sa.Float(),
               nullable=False,
               existing_nullable=True)

    # Revert reps back to NOT NULL
    op.alter_column('workout_sets', 'reps',
               existing_type=sa.Integer(),
               nullable=False,
               existing_nullable=True)
