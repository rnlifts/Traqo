"""Add uniqueness constraint on (user_id, name) for exercises

Revision ID: add_exercise_name_uniqueness_001
Revises: add_missing_indexes_001
Create Date: 2026-07-22 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_exercise_name_uniqueness_001'
down_revision = 'add_missing_indexes_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint('uq_exercises_user_id_name', 'exercises', ['user_id', 'name'])


def downgrade():
    op.drop_constraint('uq_exercises_user_id_name', 'exercises', type_='unique')
