"""merge heads after main sync

Revision ID: 59285792854d
Revises: fa25e9709f9f, 8f3a1c2d4e5f
Create Date: 2026-05-27 14:53:32.303650

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "59285792854d"
down_revision: Union[str, Sequence[str], None] = ("fa25e9709f9f", "8f3a1c2d4e5f")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
