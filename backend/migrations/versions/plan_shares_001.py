"""Add plan sharing tables and session attribution columns.

Creates plan_shares (one share config per plan: opaque link token, mode, link-tier)
and plan_share_grants (the per-user ACL for restricted shares). Adds nullable
share_id / logged_by_user_id attribution columns to workout_sessions — fixed at
log time, never retroactively changed; revocation is soft (revoked_at) so a
logged session's share_id keeps pointing at the share that existed when it was
logged.

Revision ID: plan_shares_001
Revises: change_fks_to_set_null_001
Create Date: 2026-08-04

"""
from alembic import op
import sqlalchemy as sa


revision = 'plan_shares_001'
down_revision = 'change_fks_to_set_null_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'plan_shares',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'workout_plan_id',
            sa.Integer(),
            sa.ForeignKey('workout_plans.id', ondelete='CASCADE'),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column('token', sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column('mode', sa.String(length=20), nullable=False, server_default='restricted'),
        sa.Column('link_permission', sa.String(length=10), nullable=False, server_default='view'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'plan_share_grants',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'plan_share_id',
            sa.Integer(),
            sa.ForeignKey('plan_shares.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('permission', sa.String(length=10), nullable=False, server_default='view'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('plan_share_id', 'user_id', name='uq_plan_share_grants_share_user'),
    )

    op.add_column(
        'workout_sessions',
        sa.Column(
            'share_id',
            sa.Integer(),
            sa.ForeignKey('plan_shares.id', ondelete='SET NULL', name='fk_workout_sessions_share_id'),
            nullable=True,
        ),
    )
    op.add_column(
        'workout_sessions',
        sa.Column(
            'logged_by_user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='SET NULL', name='fk_workout_sessions_logged_by_user_id'),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_constraint('fk_workout_sessions_logged_by_user_id', 'workout_sessions', type_='foreignkey')
    op.drop_constraint('fk_workout_sessions_share_id', 'workout_sessions', type_='foreignkey')
    op.drop_column('workout_sessions', 'logged_by_user_id')
    op.drop_column('workout_sessions', 'share_id')
    op.drop_table('plan_share_grants')
    op.drop_table('plan_shares')
