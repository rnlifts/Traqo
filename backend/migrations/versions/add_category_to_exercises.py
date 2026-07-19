"""Add category to exercises

Revision ID: add_category_001
Revises: add_targets_001
Create Date: 2026-07-19 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_category_001'
down_revision = 'add_targets_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('exercises', sa.Column('category', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('exercises', 'category')
