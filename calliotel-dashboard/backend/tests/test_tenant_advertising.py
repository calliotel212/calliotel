"""Tenant dashboard ↔ AdsFind advertiser linking and proxy APIs."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.deps import get_current_user, get_tenant_linked_advertiser_user
from app.main import app
from app.schemas.dashboard import DashboardAdvertisingMetrics, DashboardSummaryResponse
from app.services import dashboard_service, tenant_advertiser_service


@pytest.fixture
def client():
    fake_user = SimpleNamespace(
        id="u1",
        tenant_id="t1",
        email="owner@test.com",
        advertiser_user_id=None,
        tenant=SimpleNamespace(name="Biz", business_name="Biz LLC", phone_number=None),
    )
    fake_adv = SimpleNamespace(
        id="au1",
        advertiser_id="adv1",
        email="owner@test.com",
        advertiser=SimpleNamespace(wallet_balance=Decimal("50")),
    )

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_tenant_linked_advertiser_user] = lambda: fake_adv
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_advertising_wallet_proxy(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.dashboard.advertiser_wallet_service.get_wallet_balance",
        lambda db, advertiser_id: Decimal("42.00"),
    )
    res = client.get("/api/v1/dashboard/advertising/wallet")
    assert res.status_code == 200
    assert res.json()["balance_usd"] == "42.00"


def test_dashboard_summary_includes_advertising(client, monkeypatch):
    def fake_summary(db, *, tenant_id, user=None):
        return DashboardSummaryResponse(
            agent_status="offline",
            phone_number=None,
            calls_this_month=0,
            minutes_used=0,
            billing_status="trial",
            advertising=DashboardAdvertisingMetrics(
                ad_spend_usd=Decimal("9.50"),
                ad_clicks=3,
                active_campaigns=2,
            ),
        )

    monkeypatch.setattr(dashboard_service, "get_dashboard_summary", fake_summary)
    res = client.get("/api/v1/dashboard/summary")
    assert res.status_code == 200
    adv = res.json()["advertising"]
    assert adv["ad_clicks"] == 3
    assert adv["active_campaigns"] == 2


def test_get_or_link_reuses_explicit_id(monkeypatch):
    db = MagicMock()
    user = SimpleNamespace(
        id="u2",
        email="linked@test.com",
        advertiser_user_id="au-existing",
        tenant=SimpleNamespace(business_name="Acme", name="Acme", phone_number=None),
    )
    existing = SimpleNamespace(id="au-existing", advertiser_id="a9", email="linked@test.com")
    monkeypatch.setattr(
        tenant_advertiser_service,
        "_load_advertiser_user",
        lambda _db, _id: existing if _id == "au-existing" else None,
    )
    adv = tenant_advertiser_service.get_or_link_advertiser_user(db, user=user)
    assert adv.id == "au-existing"