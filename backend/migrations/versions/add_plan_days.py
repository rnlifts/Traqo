"""Add plan_days and plan_day_schedule tables for multi-day programs

Revision ID: add_plan_days_001
Revises: add_category_001
Create Date: 2026-07-19 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_plan_days_001'
down_revision = 'add_category_001'
branch_labels = None
depends_on = None


def upgrade():
    # Create plan_days table
    op.create_table(
        'plan_days',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workout_plan_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('order_position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workout_plan_id'], ['workout_plans.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create plan_day_schedule table (join table for weekday tags)
    op.create_table(
        'plan_day_schedule',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plan_day_id', sa.Integer(), nullable=False),
        sa.Column('weekday', sa.String(10), nullable=False),
        sa.ForeignKeyConstraint(['plan_day_id'], ['plan_days.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    connection = op.get_bind()

    # Insert "Day 1" for each existing plan
    connection.execute(
        sa.text("""
            INSERT INTO plan_days (workout_plan_id, label, order_position, created_at, updated_at)
            SELECT id, 'Day 1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM workout_plans
        """)
    )

    # Add plan_day_id column to workout_exercises and backfill it
    op.add_column('workout_exercises', sa.Column('plan_day_id', sa.Integer(), nullable=True))

    connection.execute(
        sa.text("""
            UPDATE workout_exercises
            SET plan_day_id = (
                SELECT pd.id FROM plan_days pd
                WHERE pd.workout_plan_id = workout_exercises.workout_plan_id
                LIMIT 1
            )
        """)
    )

    # Make plan_day_id NOT NULL after backfill
    op.alter_column('workout_exercises', 'plan_day_id', nullable=False)

    # Drop old constraint and column from workout_exercises
    # Use raw SQL to handle this more reliably
    connection.execute(sa.text("ALTER TABLE workout_exercises DROP CONSTRAINT workout_exercises_workout_plan_id_fkey"))
    connection.execute(sa.text("ALTER TABLE workout_exercises DROP CONSTRAINT workout_exercises_workout_plan_id_order_number_key"))
    op.drop_column('workout_exercises', 'workout_plan_id')

    # Add new constraints for workout_exercises
    op.create_foreign_key(
        'workout_exercises_plan_day_id_fkey',
        'workout_exercises',
        'plan_days',
        ['plan_day_id'],
        ['id'],
        ondelete='CASCADE'
    )

    op.create_unique_constraint(
        'workout_exercises_plan_day_id_order_number_key',
        'workout_exercises',
        ['plan_day_id', 'order_number']
    )

    # Add plan_day_id to workout_sessions
    op.add_column('workout_sessions', sa.Column('plan_day_id', sa.Integer(), nullable=True))

    connection.execute(
        sa.text("""
            UPDATE workout_sessions
            SET plan_day_id = (
                SELECT pd.id FROM plan_days pd
                WHERE pd.workout_plan_id = workout_sessions.workout_plan_id
                LIMIT 1
            )
        """)
    )

    # Create the foreign key for plan_day_id on workout_sessions
    op.create_foreign_key(
        'workout_sessions_plan_day_id_fkey',
        'workout_sessions',
        'plan_days',
        ['plan_day_id'],
        ['id']
    )


def downgrade():
    connection = op.get_bind()

    # Drop the foreign key from workout_sessions
    op.drop_constraint('workout_sessions_plan_day_id_fkey', 'workout_sessions', type_='foreignkey')
    op.drop_column('workout_sessions', 'plan_day_id')

    # Drop the FK and constraint from workout_exercises
    op.drop_constraint('workout_exercises_plan_day_id_fkey', 'workout_exercises', type_='foreignkey')
    op.drop_constraint('workout_exercises_plan_day_id_order_number_key', 'workout_exercises', type_='unique')

    # Add back workout_plan_id column
    op.add_column('workout_exercises', sa.Column('workout_plan_id', sa.Integer(), nullable=True))

    # Re-parent exercises back to plans
    connection.execute(
        sa.text("""
            UPDATE workout_exercises
            SET workout_plan_id = (
                SELECT pd.workout_plan_id FROM plan_days pd
                WHERE pd.id = workout_exercises.plan_day_id
                LIMIT 1
            )
        """)
    )

    op.alter_column('workout_exercises', 'workout_plan_id', nullable=False)

    # Recreate the original FK and constraint
    op.create_foreign_key('workout_exercises_workout_plan_id_fkey', 'workout_exercises', 'workout_plans', ['workout_plan_id'], ['id'], ondelete='CASCADE')
    op.create_unique_constraint('workout_exercises_workout_plan_id_order_number_key', 'workout_exercises', ['workout_plan_id', 'order_number'])

    # Remove plan_day_id column
    op.drop_column('workout_exercises', 'plan_day_id')

    # Drop the plan_day_schedule table
    op.drop_table('plan_day_schedule')

    # Drop the plan_days table
    op.drop_table('plan_days')
