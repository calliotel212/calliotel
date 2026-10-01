"""Tests for the reseller/developer API kill-switch.

Covers the env-flag parsing and the exact mount pattern server.py uses:
routers are only included when RESELLER_API_ENABLED is truthy, otherwise the
endpoints are absent (404).
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _fresh_gate():
    import services.reseller_gate as gate
    return importlib.reload(gate)


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on", "enabled"])
def test_flag_truthy_values_enable(monkeypatch, value):
    monkeypatch.setenv("RESELLER_API_ENABLED", value)
    gate = _fresh_gate()
    assert gate.reseller_api_enabled() is True


@pytest.mark.parametrize("value", ["", "0", "false", "no", "off", "disabled", "random"])
def test_flag_falsy_or_unset_disable(monkeypatch, value):
    monkeypatch.setenv("RESELLER_API_ENABLED", value)
    gate = _fresh_gate()
    assert gate.reseller_api_enabled() is False


def test_unset_defaults_disabled(monkeypatch):
    monkeypatch.delenv("RESELLER_API_ENABLED", raising=False)
    gate = _fresh_gate()
    assert gate.reseller_api_enabled() is False
    assert gate.log_reseller_gate_status() is False


def _build_app(enabled_env, monkeypatch):
    """Replicate server.py's gated-include pattern on a throwaway app."""
    if enabled_env is None:
        monkeypatch.delenv("RESELLER_API_ENABLED", raising=False)
    else:
        monkeypatch.setenv("RESELLER_API_ENABLED", enabled_env)
    gate = _fresh_gate()

    app = FastAPI()
    reseller = APIRouter()

    @reseller.post("/reseller-api/apply")
    def apply():
        return {"api_key": "live-key"}

    if gate.reseller_api_enabled():
        app.include_router(reseller, prefix="/api")
    return TestClient(app)


def test_reseller_endpoint_absent_when_disabled(monkeypatch):
    client = _build_app(None, monkeypatch)
    assert client.post("/api/reseller-api/apply").status_code == 404


def test_reseller_endpoint_present_when_enabled(monkeypatch):
    client = _build_app("1", monkeypatch)
    r = client.post("/api/reseller-api/apply")
    assert r.status_code == 200
    assert r.json() == {"api_key": "live-key"}


def _app_with_all_routes():
    app = FastAPI()

    @app.post("/api/reseller-api/apply")
    def _apply():
        return {"k": 1}

    @app.get("/api/reseller/me")
    def _me():
        return {}

    @app.get("/api/developer/keys")
    def _keys():
        return {}

    @app.get("/api/public-api/anything")
    def _pub():
        return {}

    # core customer routes that must survive
    @app.get("/api/auth/me")
    def _auth():
        return {}

    @app.get("/api/calls/rate")
    def _calls():
        return {}

    @app.get("/api/referrals")
    def _ref():
        return {}

    return app


def test_prune_removes_only_reseller_routes_when_disabled(monkeypatch):
    monkeypatch.delenv("RESELLER_API_ENABLED", raising=False)
    gate = _fresh_gate()
    app = _app_with_all_routes()
    removed = gate.prune_reseller_routes(app)
    assert set(removed) == {
        "/api/reseller-api/apply",
        "/api/reseller/me",
        "/api/developer/keys",
        "/api/public-api/anything",
    }
    client = TestClient(app)
    # reseller/developer gone
    assert client.post("/api/reseller-api/apply").status_code == 404
    assert client.get("/api/developer/keys").status_code == 404
    # core customer routes preserved (referrals must NOT be caught by /api/reseller)
    assert client.get("/api/auth/me").status_code == 200
    assert client.get("/api/calls/rate").status_code == 200
    assert client.get("/api/referrals").status_code == 200


def test_prune_noop_when_enabled(monkeypatch):
    monkeypatch.setenv("RESELLER_API_ENABLED", "1")
    gate = _fresh_gate()
    app = _app_with_all_routes()
    assert gate.prune_reseller_routes(app) == []
    client = TestClient(app)
    assert client.post("/api/reseller-api/apply").status_code == 200
