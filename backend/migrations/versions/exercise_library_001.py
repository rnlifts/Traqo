"""Add exercise_library_items table for global, curated exercise library.

Revision ID: exercise_library_001
Revises: plan_cascade_deletes_001
Create Date: 2026-07-28

"""
from alembic import op
import sqlalchemy as sa


revision = 'exercise_library_001'
down_revision = 'plan_cascade_deletes_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'exercise_library_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('muscle_group', sa.String(50), nullable=False),
        sa.Column('equipment', sa.String(100), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'muscle_group', name='uq_library_name_muscle'),
    )
    op.create_index('ix_exercise_library_items_muscle_group', 'exercise_library_items', ['muscle_group'])


def downgrade():
    op.drop_index('ix_exercise_library_items_muscle_group', table_name='exercise_library_items')
    op.drop_table('exercise_library_items')
