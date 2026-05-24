"""add_users_table

Revision ID: c9e1f2a3b4d5
Revises: bb7bc6b50087
Create Date: 2026-05-20 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "c9e1f2a3b4d5"
down_revision: Union[str, Sequence[str], None] = "bb7bc6b50087"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            BIGSERIAL PRIMARY KEY,
            username      VARCHAR(32) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS users")
