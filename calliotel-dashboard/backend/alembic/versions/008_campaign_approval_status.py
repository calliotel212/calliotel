"""Campaign admin approval statuses (pending_approval, rejected)

Revision ID: 008_campaign_approval
Revises: 007_campaign_targeting
Create Date: 2026-11-23

Existing production campaigns remain ``active`` or ``paused`` so matching is unchanged.
New advertiser-created campaigns default to ``pending_approval`` at the application layer.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "008_campaign_approval"
down_revision: Union[str, None] = "007_campaign_targeting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_KNOWN = ("active", "paused", "pending_approval", "rejected")


def upgrade() -> None:
    placeholders = ", ".join(f"'{s}'" for s in _KNOWN)
    op.execute(
        f"UPDATE campaigns SET status = 'active' WHERE status IS NULL OR status NOT IN ({placeholders})"
    )


def downgrade() -> None:
    pass