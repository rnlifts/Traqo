"""Add optional user profile fields for BMI/BMR/maintenance-calorie calculations

Revision ID: add_user_profile_fields_001
Revises: plan_shares_001
Create Date: 2026-08-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_user_profile_fields_001'
down_revision = 'plan_shares_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('age', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('weight_kg', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('height_cm', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('gender', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('activity_level', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'activity_level')
    op.drop_column('users', 'gender')
    op.drop_column('users', 'height_cm')
    op.drop_column('users', 'weight_kg')
    op.drop_column('users', 'age')
