"""Publisher accounts, API keys, and earnings."""

from __future__ import annotations

import hashlib
import secrets
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.security import (
    create_publisher_access_token,
    hash_password,
    verify_password,
)
from app.models.ads import Publisher, PublisherEvent, PublisherUser


def hash_publisher_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_publisher_api_key() -> str:
    return f"pub_{secrets.token_urlsafe(32)}"


def mask_api_key(last4: str) -> str:
    suffix = (last4 or "").strip()[-4:]
    return f"****{suffix}" if suffix else "****"


def register_publisher(
    db: Session,
    *,
    email: str,
    password: str,
    name: str | None = None,
) -> tuple[PublisherUser, str]:
    existing = db.query(PublisherUser).filter(PublisherUser.email == email.lower()).first()
    if existing:
        raise ValueError("Email already registered")
    display_name = (name or email.split("@")[0]).strip() or "Publisher"
    raw_key = generate_publisher_api_key()
    publisher = Publisher(
        name=display_name,
        api_key_hash=hash_publisher_api_key(raw_key),
        api_key_last4=raw_key[-4:],
    )
    db.add(publisher)
    db.flush()
    user = PublisherUser(
        email=email.lower(),
        password_hash=hash_password(password),
        publisher_id=publisher.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, raw_key


def authenticate_publisher(db: Session, *, email: str, password: str) -> PublisherUser | None:
    user = (
        db.query(PublisherUser)
        .options(joinedload(PublisherUser.publisher))
        .filter(PublisherUser.email == email.lower())
        .first()
    )
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_for_publisher_user(user: PublisherUser) -> str:
    return create_publisher_access_token(
        publisher_user_id=user.id,
        publisher_id=user.publisher_id,
        email=user.email,
    )


def get_publisher_by_api_key(db: Session, raw_key: str) -> Publisher | None:
    if not raw_key.strip():
        return None
    digest = hash_publisher_api_key(raw_key.strip())
    return db.scalar(select(Publisher).where(Publisher.api_key_hash == digest))


def rotate_publisher_api_key(db: Session, *, publisher_id: str) -> tuple[str, Publisher]:
    publisher = db.get(Publisher, publisher_id)
    if publisher is None:
        raise ValueError("Publisher not found")
    raw_key = generate_publisher_api_key()
    publisher.api_key_hash = hash_publisher_api_key(raw_key)
    publisher.api_key_last4 = raw_key[-4:]
    db.commit()
    db.refresh(publisher)
    return raw_key, publisher


def publisher_stats(db: Session, *, publisher: Publisher, publisher_user_id: str, email: str) -> dict:
    clicks = int(
        db.scalar(
            select(func.count())
            .select_from(PublisherEvent)
            .where(
                PublisherEvent.publisher_id == publisher.id,
                PublisherEvent.event_type.in_(("impression", "click")),
            )
        )
        or 0
    )
    revenue_row = db.scalar(
        select(func.coalesce(func.sum(PublisherEvent.revenue_amount), 0)).where(
            PublisherEvent.publisher_id == publisher.id
        )
    )
    total_revenue = Decimal(str(revenue_row or 0))
    return {
        "id": publisher_user_id,
        "email": email,
        "publisher_id": publisher.id,
        "name": publisher.name,
        "pending_balance": Decimal(str(publisher.pending_balance)),
        "paid_balance": Decimal(str(publisher.paid_balance)),
        "total_clicks": clicks,
        "total_revenue": total_revenue,
        "revenue_share_percentage": Decimal(str(publisher.revenue_share_percentage)),
        "api_key_masked": mask_api_key(publisher.api_key_last4),
        "active_api_keys": 1 if publisher.api_key_hash else 0,
    }


def list_publishers_for_admin(db: Session) -> list[dict]:
    """Rows for admin console (see admin PR list_publishers integration)."""
    publishers = db.scalars(select(Publisher).order_by(Publisher.name)).all()
    out: list[dict] = []
    for pub in publishers:
        user_count = db.scalar(
            select(func.count()).select_from(PublisherUser).where(PublisherUser.publisher_id == pub.id)
        )
        clicks = db.scalar(
            select(func.count())
            .select_from(PublisherEvent)
            .where(PublisherEvent.publisher_id == pub.id, PublisherEvent.event_type == "impression")
        )
        out.append(
            {
                "id": pub.id,
                "name": pub.name,
                "pending_balance": Decimal(str(pub.pending_balance)),
                "paid_balance": Decimal(str(pub.paid_balance)),
                "user_count": int(user_count or 0),
                "impressions": int(clicks or 0),
            }
        )
    return out


def publisher_earnings_for_event(
    campaign_max_cpc: float | Decimal,
    revenue_share_percentage: float | Decimal,
) -> Decimal:
    """Publisher share on each served impression (mock until click tracking)."""
    cpc = Decimal(str(campaign_max_cpc or 0))
    share = Decimal(str(revenue_share_percentage or 0)) / Decimal("100")
    return (cpc * share).quantize(Decimal("0.0001"))