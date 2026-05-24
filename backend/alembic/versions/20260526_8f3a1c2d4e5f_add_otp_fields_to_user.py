"""add_otp_fields_to_user

Revision ID: 8f3a1c2d4e5f
Revises: c1ab0ed0ad93
Create Date: 2026-05-26 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "8f3a1c2d4e5f"
down_revision: Union[str, Sequence[str], None] = "c1ab0ed0ad93"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'player',
            ADD COLUMN IF NOT EXISTS otp_code TEXT,
            ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS login_attempts SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS otp_attempts SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ
        """
    )

    op.execute("UPDATE users SET email = username || '@example.com' WHERE email IS NULL")
    op.execute("UPDATE users SET role = 'admin' WHERE username = 'admin'")
    op.execute("UPDATE users SET role = 'player' WHERE role IS NULL")
    op.execute("UPDATE users SET login_attempts = 0 WHERE login_attempts IS NULL")
    op.execute("UPDATE users SET otp_attempts = 0 WHERE otp_attempts IS NULL")

    op.execute("ALTER TABLE users ALTER COLUMN email SET NOT NULL")
    op.execute("ALTER TABLE users ALTER COLUMN role SET NOT NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS users_email_unique_idx")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS otp_locked_until")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS otp_attempts")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS login_locked_until")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS login_attempts")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS otp_expires_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS otp_code")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS role")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email")
