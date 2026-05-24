"""add_attack_defense_to_event_class

Revision ID: dcfa03b93c5e
Revises: c9e1f2a3b4d5
Create Date: 2026-05-21 13:46:17.935042

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "dcfa03b93c5e"
down_revision: Union[str, Sequence[str], None] = "c9e1f2a3b4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE event_class_new AS ENUM ('background', 'attack', 'defense')")
    op.execute(
        "UPDATE events SET event_class = 'background' "
        "WHERE event_class::text NOT IN ('background', 'attack', 'defense')"
    )
    op.execute(
        "UPDATE training_samples SET label = 'background' WHERE label::text NOT IN ('background', 'attack', 'defense')"
    )
    op.execute(
        "ALTER TABLE events ALTER COLUMN event_class TYPE event_class_new USING event_class::text::event_class_new"
    )
    op.execute(
        "ALTER TABLE training_samples ALTER COLUMN label TYPE event_class_new USING label::text::event_class_new"
    )
    op.execute("DROP TYPE event_class")
    op.execute("ALTER TYPE event_class_new RENAME TO event_class")


def downgrade() -> None:
    op.execute("CREATE TYPE event_class_old AS ENUM ('background', 'footstep', 'door_slam', 'impact', 'unknown')")
    op.execute(
        "ALTER TABLE events ALTER COLUMN event_class TYPE event_class_old USING event_class::text::event_class_old"
    )
    op.execute(
        "ALTER TABLE training_samples ALTER COLUMN label TYPE event_class_old USING label::text::event_class_old"
    )
    op.execute("DROP TYPE event_class")
    op.execute("ALTER TYPE event_class_old RENAME TO event_class")
