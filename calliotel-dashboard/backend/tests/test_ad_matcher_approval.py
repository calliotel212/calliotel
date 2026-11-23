"""Ad matcher must not serve campaigns pending admin approval."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.ad_matcher import SERVABLE_CAMPAIGN_STATUSES, find_sponsored_ad


def test_servable_statuses_exclude_pending():
    assert "pending_approval" not in SERVABLE_CAMPAIGN_STATUSES
    assert "pending_review" not in SERVABLE_CAMPAIGN_STATUSES
    assert "rejected" not in SERVABLE_CAMPAIGN_STATUSES
    assert "active" in SERVABLE_CAMPAIGN_STATUSES


def test_find_sponsored_ad_no_match_without_active_campaigns():
    db = MagicMock()
    result = MagicMock()
    result.all.return_value = []
    db.scalars.return_value = result

    assert find_sponsored_ad(db, "running shoes sneakers", log_event=False) is None


def test_pending_campaign_not_in_servable_set():
    pending = SimpleNamespace(status="pending_review")
    assert pending.status not in SERVABLE_CAMPAIGN_STATUSES