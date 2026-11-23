"""48-hour campaign review and auto-activation."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.ad_matcher import SERVABLE_CAMPAIGN_STATUSES
from app.services.campaign_review_service import (
    PENDING_REVIEW_STATUS,
    process_due_campaign_reviews,
)


def test_servable_excludes_pending_review():
    assert PENDING_REVIEW_STATUS not in SERVABLE_CAMPAIGN_STATUSES
    assert "pending_approval" not in SERVABLE_CAMPAIGN_STATUSES


def test_auto_activate_after_review_window():
    db = MagicMock()
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    campaign = SimpleNamespace(
        id="c1",
        advertiser_id="a1",
        status=PENDING_REVIEW_STATUS,
        review_ends_at=past,
        advertiser=SimpleNamespace(),
    )
    scalars_result = MagicMock()
    scalars_result.unique.return_value.all.return_value = [campaign]
    db.scalars.return_value = scalars_result
    db.scalar.return_value = "unverified"

    count = process_due_campaign_reviews(db)
    assert count == 1
    assert campaign.status == "active"
    db.commit.assert_called_once()


def test_rejected_kyc_blocks_auto_activate():
    db = MagicMock()
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    campaign = SimpleNamespace(
        id="c2",
        advertiser_id="a2",
        status=PENDING_REVIEW_STATUS,
        review_ends_at=past,
        advertiser=SimpleNamespace(),
    )
    scalars_result = MagicMock()
    scalars_result.unique.return_value.all.return_value = [campaign]
    db.scalars.return_value = scalars_result
    db.scalar.return_value = "rejected"

    count = process_due_campaign_reviews(db)
    assert count == 1
    assert campaign.status == "rejected"


def test_find_sponsored_ad_runs_review_hook():
    db = MagicMock()
    result = MagicMock()
    result.all.return_value = []
    db.scalars.return_value = result

    with patch("app.services.ad_matcher.ensure_review_processed") as hook:
        from app.services.ad_matcher import find_sponsored_ad

        find_sponsored_ad(db, "shoes", log_event=False)
        hook.assert_called_once_with(db)