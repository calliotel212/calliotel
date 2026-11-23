"""Auto-link tenant dashboard users to AdsFind advertiser accounts."""

from __future__ import annotations

import secrets

from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.ads import Advertiser, AdvertiserUser
from app.models.user import User


def _load_advertiser_user(db: Session, advertiser_user_id: str) -> AdvertiserUser | None:
    return (
        db.query(AdvertiserUser)
        .options(joinedload(AdvertiserUser.advertiser))
        .filter(AdvertiserUser.id == advertiser_user_id)
        .first()
    )


def get_or_link_advertiser_user(db: Session, *, user: User) -> AdvertiserUser:
    """
    Resolve the advertiser identity for a logged-in tenant user.

    1. Use users.advertiser_user_id when set.
    2. Else attach an existing AdvertiserUser with the same email.
    3. Else provision Advertiser + AdvertiserUser from tenant profile (no extra signup).
    """
    if user.advertiser_user_id:
        linked = _load_advertiser_user(db, user.advertiser_user_id)
        if linked is not None:
            return linked

    existing = (
        db.query(AdvertiserUser)
        .options(joinedload(AdvertiserUser.advertiser))
        .filter(AdvertiserUser.email == user.email.lower())
        .first()
    )
    if existing is not None:
        user.advertiser_user_id = existing.id
        db.commit()
        db.refresh(user)
        return existing

    tenant = user.tenant
    display = (tenant.business_name or tenant.name or user.email.split("@")[0]).strip() or "My Business"
    phone = tenant.phone_number

    advertiser = Advertiser(name=display)
    db.add(advertiser)
    db.flush()

    adv_user = AdvertiserUser(
        email=user.email.lower(),
        password_hash=hash_password(secrets.token_urlsafe(32)),
        advertiser_id=advertiser.id,
        business_name=display,
        phone_number=phone,
        website_url=None,
        kyc_status="unverified",
    )
    db.add(adv_user)
    db.flush()

    user.advertiser_user_id = adv_user.id
    db.commit()
    db.refresh(adv_user)
    db.refresh(user)
    return _load_advertiser_user(db, adv_user.id) or adv_user