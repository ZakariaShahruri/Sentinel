"""add_trigers_and_procedures

Revision ID: d3371231d69e
Revises: fa0309d34570
Create Date: 2026-05-26 13:15:12.949602

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d3371231d69e"
down_revision: Union[str, Sequence[str], None] = "fa0309d34570"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE OR REPLACE FUNCTION upsert_node_and_update_last_seen()
    RETURNS TRIGGER AS $$
    BEGIN 
        INSERT INTO nodes (node_id, last_seen)
        VALUES (NEW.node_id, NOW())
        ON CONFLICT (node_id) DO UPDATE SET last_seen = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trigger_events_upsert_node
        BEFORE INSERT ON events
        FOR EACH ROW EXECUTE FUNCTION upsert_node_and_update_last_seen()""")

    op.execute("""
            CREATE TRIGGER trigger_tilt_upsert_node
            BEFORE INSERT ON tilt_readings
            FOR EACH ROW EXECUTE FUNCTION upsert_node_and_update_last_seen();
            """)

    op.execute("""
        CREATE OR REPLACE PROCEDURE cleanup_old_tilt_readings(p_days_to_keep INT)
        LANGUAGE plpgsql AS $$
        BEGIN
            DELETE FROM tilt_readings
            WHERE received_at < NOW() - (p_days_to_keep || ' days'):: INTERVAL;
            END;
        $$
               """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS trigger_events_upsert_node")
    op.execute("DROP TRIGGER IF EXISTS trigger_tilt_upsert_node")
    op.execute("DROP FUNCTION IF EXISTS upsert_node_and_update_last_seen")
    op.execute("DROP PROCEDURE IF EXISTS cleanup_old_tilt_readings(INT)")
