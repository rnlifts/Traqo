"""Add plan_weeks table and week-chain support for multi-week programs

Revision ID: add_plan_weeks_001
Revises: add_plan_days_001
Create Date: 2026-07-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_plan_weeks_001'
down_revision = 'add_plan_days_001'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    # 1. Add unit_type and total_units to workout_plans
    op.add_column('workout_plans', sa.Column('unit_type', sa.String(10), nullable=True))
    op.add_column('workout_plans', sa.Column('total_units', sa.Integer(), nullable=True))

    # 2. Add is_rest to plan_days
    op.add_column('plan_days', sa.Column('is_rest', sa.Boolean(), nullable=False, server_default=sa.false()))

    # 3. Add plan_week_id to plan_days (before creating the table, we'll make it nullable initially)
    op.add_column('plan_days', sa.Column('plan_week_id', sa.Integer(), nullable=True))

    # 4. Add notes to workout_exercises
    op.add_column('workout_exercises', sa.Column('notes', sa.Text(), nullable=False, server_default=''))

    # 5. Add plan_week_id to workout_sessions
    op.add_column('workout_sessions', sa.Column('plan_week_id', sa.Integer(), nullable=True))

    # 6. Create plan_weeks table
    op.create_table(
        'plan_weeks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workout_plan_id', sa.Integer(), nullable=False),
        sa.Column('week_number', sa.Integer(), nullable=False),
        sa.Column('mode', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workout_plan_id'], ['workout_plans.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 7. Add foreign keys for plan_week_id columns (now that plan_weeks table exists)
    op.create_foreign_key(
        'plan_days_plan_week_id_fkey',
        'plan_days',
        'plan_weeks',
        ['plan_week_id'],
        ['id'],
        ondelete='CASCADE'
    )

    op.create_foreign_key(
        'workout_sessions_plan_week_id_fkey',
        'workout_sessions',
        'plan_weeks',
        ['plan_week_id'],
        ['id']
    )

    # 8. Backfill unit_type and total_units for existing plans
    # For each existing plan, set unit_type='days' and total_units=COUNT(plan_days)
    connection.execute(
        sa.text("""
            UPDATE workout_plans wp
            SET unit_type = 'days',
                total_units = (
                    SELECT COUNT(*) FROM plan_days pd
                    WHERE pd.workout_plan_id = wp.id
                )
        """)
    )

    # 9. Drop plan_day_schedule table (entire weekday-tag mechanism is retired)
    op.drop_table('plan_day_schedule')


def downgrade():
    connection = op.get_bind()

    # Recreate plan_day_schedule table
    op.create_table(
        'plan_day_schedule',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plan_day_id', sa.Integer(), nullable=False),
        sa.Column('weekday', sa.String(10), nullable=False),
        sa.ForeignKeyConstraint(['plan_day_id'], ['plan_days.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Drop foreign keys
    op.drop_constraint('workout_sessions_plan_week_id_fkey', 'workout_sessions', type_='foreignkey')
    op.drop_constraint('plan_days_plan_week_id_fkey', 'plan_days', type_='foreignkey')

    # Drop plan_weeks table
    op.drop_table('plan_weeks')

    # Remove columns from workout_sessions
    op.drop_column('workout_sessions', 'plan_week_id')

    # Remove notes column from workout_exercises
    op.drop_column('workout_exercises', 'notes')

    # Remove plan_week_id and is_rest from plan_days
    op.drop_column('plan_days', 'plan_week_id')
    op.drop_column('plan_days', 'is_rest')

    # Remove unit_type and total_units from workout_plans
    op.drop_column('workout_plans', 'total_units')
    op.drop_column('workout_plans', 'unit_type')
