"""Add field-presence flags and per-set targets for workout exercises.

Revision ID: add_set_target_flags_001
Revises: add_duration_to_sets_001
Create Date: 2026-07-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_set_target_flags_001'
down_revision = 'add_duration_to_sets_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add field-presence flags to workout_exercises
    op.add_column('workout_exercises', sa.Column('has_reps', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('workout_exercises', sa.Column('has_weight', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('workout_exercises', sa.Column('has_duration', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('workout_exercises', sa.Column('target_duration_seconds', sa.Integer(), nullable=True))

    # Convert target_reps from Integer to String(20), preserving existing data
    op.alter_column('workout_exercises', 'target_reps',
                    existing_type=sa.Integer(),
                    type_=sa.String(20),
                    nullable=True,
                    postgresql_using='target_reps::text')

    # Create workout_exercise_set_targets table
    op.create_table(
        'workout_exercise_set_targets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workout_exercise_id', sa.Integer(), nullable=False),
        sa.Column('set_number', sa.Integer(), nullable=False),
        sa.Column('target_reps', sa.String(20), nullable=True),
        sa.Column('target_weight', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['workout_exercise_id'], ['workout_exercises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workout_exercise_id', 'set_number', name='uq_workout_exercise_set_number')
    )
    op.create_index(op.f('ix_workout_exercise_set_targets_workout_exercise_id'), 'workout_exercise_set_targets', ['workout_exercise_id'], unique=False)


def downgrade():
    # Drop the index and table
    op.drop_index(op.f('ix_workout_exercise_set_targets_workout_exercise_id'), table_name='workout_exercise_set_targets')
    op.drop_table('workout_exercise_set_targets')

    # Revert target_reps back to Integer
    op.alter_column('workout_exercises', 'target_reps',
                    existing_type=sa.String(20),
                    type_=sa.Integer(),
                    nullable=True,
                    postgresql_using='target_reps::integer')

    # Remove field-presence flags and duration field
    op.drop_column('workout_exercises', 'target_duration_seconds')
    op.drop_column('workout_exercises', 'has_duration')
    op.drop_column('workout_exercises', 'has_weight')
    op.drop_column('workout_exercises', 'has_reps')
