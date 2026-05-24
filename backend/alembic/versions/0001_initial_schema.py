"""initial_schema

Revision ID: bb7bc6b50087
Revises:
Create Date: 2026-05-19 09:21:56.325772

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bb7bc6b50087"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE event_class AS ENUM (
            'background', 'footstep', 'door_slam', 'impact', 'unknown'
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            node_id       BIGINT PRIMARY KEY,
            location      VARCHAR(64),
            registered_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen     TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id             BIGSERIAL PRIMARY KEY,
            node_id        BIGINT REFERENCES nodes(node_id),
            event_class    event_class NOT NULL,
            confidence     SMALLINT CHECK (confidence BETWEEN 0 AND 100),
            sequence_num   SMALLINT NOT NULL,
            node_timestamp BIGINT NOT NULL,
            peak_amplitude FLOAT,
            rms_energy     FLOAT,
            zcr            FLOAT,
            decay_ms       FLOAT,
            received_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS heartbeats (
            id          BIGSERIAL PRIMARY KEY,
            node_id     BIGINT REFERENCES nodes(node_id),
            received_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS tamper_events (
            id           BIGSERIAL PRIMARY KEY,
            node_id      BIGINT REFERENCES nodes(node_id),
            ldr_value    FLOAT,
            triggered_at TIMESTAMPTZ DEFAULT NOW(),
            resolved_at  TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS training_samples (
            id             BIGSERIAL PRIMARY KEY,
            label          event_class NOT NULL,
            peak_amplitude FLOAT NOT NULL,
            rms_energy     FLOAT NOT NULL,
            zcr            FLOAT NOT NULL,
            decay_ms       FLOAT NOT NULL,
            collected_at   TIMESTAMPTZ DEFAULT NOW(),
            notes          TEXT
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS training_samples")
    op.execute("DROP TABLE IF EXISTS tamper_events")
    op.execute("DROP TABLE IF EXISTS heartbeats")
    op.execute("DROP TABLE IF EXISTS events")
    op.execute("DROP TABLE IF EXISTS nodes")
    op.execute("DROP TYPE IF EXISTS event_class")
