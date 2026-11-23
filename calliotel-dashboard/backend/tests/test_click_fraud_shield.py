"""Redis-backed duplicate click shield for ``GET /r/{token}``."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import fakeredis.aioredis
import pytest

from app.core import redis as redis_core
from app.models.ad_event_types import INVALID_FRAUD, VALID_CLICK
from app.services.click_token_service import create_click_token
from app.services.click_tracking_service import build_fraud_hash, process_click_redirect


@pytest.fixture
async def fake_redis():
  client = fakeredis.aioredis.FakeRedis(decode_responses=True)
  await client.flushdb()
  with patch.object(redis_core, "_client", client):
    yield client
  await client.aclose()


@pytest.fixture
def db_session():
  session = MagicMock()
  advertiser = SimpleNamespace(wallet_balance=Decimal("100"))
  campaign = SimpleNamespace(
    id="camp-1",
    advertiser_id="adv-1",
    destination_url="https://example.com/land",
    max_cpc=Decimal("2.50"),
    advertiser=advertiser,
  )

  def get_side_effect(model, pk):
    if pk == "camp-1":
      return campaign
    return None

  session.get.side_effect = get_side_effect
  session.add = MagicMock()
  session.commit = MagicMock()
  session.flush = MagicMock()
  return session, campaign, advertiser


@pytest.mark.asyncio
async def test_duplicate_click_within_24h_no_second_debit(fake_redis, db_session, monkeypatch):
  session, campaign, advertiser = db_session
  token = create_click_token(campaign_id=campaign.id)
  ip, ua = "203.0.113.10", "TestBot/1.0"

  debits: list[Decimal] = []

  def fake_debit(db, *, advertiser_id, amount_usd):
    debits.append(amount_usd)
    advertiser.wallet_balance -= amount_usd
    return advertiser.wallet_balance

  monkeypatch.setattr(
    "app.services.click_tracking_service.advertiser_wallet_service.debit_funds",
    fake_debit,
  )

  first = await process_click_redirect(session, token=token, ip_address=ip, user_agent=ua)
  second = await process_click_redirect(session, token=token, ip_address=ip, user_agent=ua)

  assert first.event_type == VALID_CLICK
  assert first.debited is True
  assert second.event_type == INVALID_FRAUD
  assert second.debited is False
  assert len(debits) == 1
  assert debits[0] == Decimal("2.50")


def test_fraud_hash_is_deterministic():
  h1 = build_fraud_hash(ip_address="1.2.3.4", user_agent="Mozilla", campaign_id="abc")
  h2 = build_fraud_hash(ip_address="1.2.3.4", user_agent="Mozilla", campaign_id="abc")
  h3 = build_fraud_hash(ip_address="1.2.3.4", user_agent="Other", campaign_id="abc")
  assert h1 == h2
  assert h1 != h3