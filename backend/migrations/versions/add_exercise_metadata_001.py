"""Add muscle_group, equipment, video_url to exercises table.

Revision ID: add_exercise_metadata_001
Revises: exercise_library_001
Create Date: 2026-07-31

Rename exercises.category -> exercises.muscle_group, add equipment and video_url columns.
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_exercise_metadata_001'
down_revision = 'exercise_library_001'
branch_labels = None
depends_on = None


def upgrade():
    # Rename category to muscle_group
    op.alter_column('exercises', 'category', new_column_name='muscle_group')

    # Add new columns
    op.add_column('exercises', sa.Column('equipment', sa.String(100), nullable=True))
    op.add_column('exercises', sa.Column('video_url', sa.String(500), nullable=True))


def downgrade():
    # Drop new columns
    op.drop_column('exercises', 'video_url')
    op.drop_column('exercises', 'equipment')

    # Rename muscle_group back to category
    op.alter_column('exercises', 'muscle_group', new_column_name='category')
