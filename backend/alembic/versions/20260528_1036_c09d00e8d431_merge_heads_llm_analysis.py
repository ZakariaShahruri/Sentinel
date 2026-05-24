"""merge heads

Revision ID: c09d00e8d431
Revises: 03babab07eb3, 59285792854d
Create Date: 2026-05-28 10:36:19.386839

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "c09d00e8d431"
down_revision: Union[str, Sequence[str], None] = ("03babab07eb3", "59285792854d")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
