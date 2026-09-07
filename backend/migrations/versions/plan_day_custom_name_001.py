"""Add optional custom_name column to plan_days.

Separate from the existing `label` column (which holds the auto-numbered
"Day 1" / "Day 2" text and stays exactly as-is). `custom_name` is an
additional, optional nickname a plan owner can set per day (e.g. "Chest
Day"), displayed alongside the existing "Day N" label, not replacing it.
Nullable, no backfill: existing days simply have custom_name = NULL,
meaning "not set" -- everywhere this is displayed falls back to showing
just the existing label when custom_name is absent.

Revision ID: plan_day_custom_name_001
Revises: add_user_profile_fields_001
Create Date: 2026-09-07

"""
from alembic import op
import sqlalchemy as sa


revision = 'plan_day_custom_name_001'
down_revision = 'add_user_profile_fields_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('plan_days', sa.Column('custom_name', sa.String(255), nullable=True))


def downgrade():
    op.drop_column('plan_days', 'custom_name')
