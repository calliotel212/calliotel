"""Admin campaign approval API."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.admin_deps import require_admin
from app.main import app
from app.services import admin_service


@pytest.fixture
def client():
    app.dependency_overrides[require_admin] = lambda: {"type": "admin"}
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_approve_campaign_endpoint(client, monkeypatch):
    fake_campaign = MagicMock()
    fake_campaign.id = "camp-123"
    fake_campaign.status = "active"

    monkeypatch.setattr(
        admin_service,
        "approve_campaign",
        lambda db, campaign_id: fake_campaign if campaign_id == "camp-123" else None,
    )

    res = client.post("/api/v1/admin/campaigns/camp-123/approve")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "camp-123"
    assert body["status"] == "active"


def test_approve_campaign_not_found(client, monkeypatch):
    monkeypatch.setattr(admin_service, "approve_campaign", lambda db, campaign_id: None)

    res = client.post("/api/v1/admin/campaigns/missing/approve")
    assert res.status_code == 404