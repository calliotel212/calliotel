"""Tests for the Telnyx webhook Ed25519 signature verifier (fail-closed)."""
from __future__ import annotations

import base64
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from nacl.signing import SigningKey

from services.telnyx_webhook_verify import (
    is_configured,
    log_config_status,
    verify_telnyx_signature,
)


def _keypair_and_public_b64():
    signing_key = SigningKey.generate()
    public_b64 = base64.b64encode(bytes(signing_key.verify_key)).decode("ascii")
    return signing_key, public_b64


def _sign(signing_key: SigningKey, timestamp: str, body: bytes) -> str:
    signed = timestamp.encode("utf-8") + b"|" + body
    return base64.b64encode(signing_key.sign(signed).signature).decode("ascii")


def test_valid_signature_passes(monkeypatch):
    signing_key, public_b64 = _keypair_and_public_b64()
    monkeypatch.setenv("TELNYX_PUBLIC_KEY", public_b64)
    ts = str(int(time.time()))
    body = b'{"data":{"event_type":"call.answered"}}'
    sig = _sign(signing_key, ts, body)
    assert verify_telnyx_signature(body, sig, ts) is True


def test_tampered_body_fails(monkeypatch):
    signing_key, public_b64 = _keypair_and_public_b64()
    monkeypatch.setenv("TELNYX_PUBLIC_KEY", public_b64)
    ts = str(int(time.time()))
    sig = _sign(signing_key, ts, b'{"amount":1}')
    assert verify_telnyx_signature(b'{"amount":9999}', sig, ts) is False


def test_signature_from_other_key_fails(monkeypatch):
    _, public_b64 = _keypair_and_public_b64()
    attacker_key, _ = _keypair_and_public_b64()
    monkeypatch.setenv("TELNYX_PUBLIC_KEY", public_b64)
    ts = str(int(time.time()))
    body = b'{"data":{}}'
    forged = _sign(attacker_key, ts, body)
    assert verify_telnyx_signature(body, forged, ts) is False


def test_stale_timestamp_fails(monkeypatch):
    signing_key, public_b64 = _keypair_and_public_b64()
    monkeypatch.setenv("TELNYX_PUBLIC_KEY", public_b64)
    old_ts = str(int(time.time()) - 3600)
    body = b'{"data":{}}'
    sig = _sign(signing_key, old_ts, body)
    assert verify_telnyx_signature(body, sig, old_ts) is False


def test_missing_headers_fail(monkeypatch):
    _, public_b64 = _keypair_and_public_b64()
    monkeypatch.setenv("TELNYX_PUBLIC_KEY", public_b64)
    assert verify_telnyx_signature(b"{}", None, None) is False
    assert verify_telnyx_signature(b"{}", "sig", None) is False


def test_unconfigured_key_fails_closed(monkeypatch):
    monkeypatch.delenv("TELNYX_PUBLIC_KEY", raising=False)
    ready, reason = is_configured()
    assert ready is False
    assert "TELNYX_PUBLIC_KEY" in reason
    assert verify_telnyx_signature(b"{}", "sig", str(int(time.time()))) is False
    assert log_config_status() is False


def test_is_configured_true_when_ready(monkeypatch):
    _, public_b64 = _keypair_and_public_b64()
    monkeypatch.setenv("TELNYX_PUBLIC_KEY", public_b64)
    ready, reason = is_configured()
    assert ready is True
    assert reason == "ok"
    assert log_config_status() is True
