"""Repurpose exercises.category → muscle_group, add equipment and video_url.

This migration:
1. Renames exercises.category to exercises.muscle_group (genuine rename, not drop+recreate)
2. Adds exercises.equipment (String(100), nullable)
3. Adds exercises.video_url (String(500), nullable)

The category column is confirmed always NULL in production, so no data migration needed.

Revision ID: repurpose_category_001
Revises: exercise_library_001
Create Date: 2026-07-30

"""
from alembic import op
import sqlalchemy as sa


revision = 'repurpose_category_001'
down_revision = 'exercise_library_001'
branch_labels = None
depends_on = None


def upgrade():
    # Rename category → muscle_group (genuine rename, not drop+recreate)
    op.alter_column('exercises', 'category', new_column_name='muscle_group')

    # Add equipment column
    op.add_column('exercises', sa.Column('equipment', sa.String(100), nullable=True))

    # Add video_url column
    op.add_column('exercises', sa.Column('video_url', sa.String(500), nullable=True))


def downgrade():
    # Remove video_url column
    op.drop_column('exercises', 'video_url')

    # Remove equipment column
    op.drop_column('exercises', 'equipment')

    # Rename muscle_group → category (reverse the rename)
    op.alter_column('exercises', 'muscle_group', new_column_name='category')
