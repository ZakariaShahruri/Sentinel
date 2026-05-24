"""update_cleanup_trigger

Revision ID: 98e3ef0ce5fb
Revises: a9352e95809b
Create Date: 2026-05-26 15:10:57.919543

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "98e3ef0ce5fb"
down_revision: Union[str, Sequence[str], None] = "a9352e95809b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE OR REPLACE PROCEDURE cleanup_old_tilt_readings(p_days_to_keep INT)
    LANGUAGE plpgsql AS $$
    BEGIN
        DELETE FROM tilt_readings
        WHERE received_at < NOW() - (p_days_to_keep || ' days'):: INTERVAL;

        DELETE FROM games
        WHERE id NOT IN (
                SELECT DISTINCT game_id FROM tilt_readings
            );
    END;
    $$;
                    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        CREATE OR REPLACE PROCEDURE cleanup_old_tilt_readings(p_days_to_keep INT)
        LANGUAGE plpgsql AS $$
        BEGIN
            DELETE FROM tilt_readings
            WHERE received_at < NOW() - (p_days_to_keep || ' days'):: INTERVAL;
            END;
        $$
               """)
