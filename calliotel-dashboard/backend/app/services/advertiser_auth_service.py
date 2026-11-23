from sqlalchemy.orm import Session, joinedload

from app.core.security import (
    create_advertiser_access_token,
    hash_password,
    verify_password,
)
from app.models.ads import Advertiser, AdvertiserUser


def register_advertiser(
    db: Session,
    *,
    email: str,
    password: str,
    business_name: str | None = None,
    phone_number: str | None = None,
    website_url: str | None = None,
) -> AdvertiserUser:
    existing = db.query(AdvertiserUser).filter(AdvertiserUser.email == email.lower()).first()
    if existing:
        raise ValueError("Email already registered")
    name = (business_name or email.split("@")[0]).strip() or "My Business"
    advertiser = Advertiser(name=name)
    db.add(advertiser)
    db.flush()
    user = AdvertiserUser(
        email=email.lower(),
        password_hash=hash_password(password),
        advertiser_id=advertiser.id,
        business_name=name,
        phone_number=(phone_number or "").strip() or None,
        website_url=(website_url or "").strip() or None,
        kyc_status="unverified",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_advertiser(db: Session, *, email: str, password: str) -> AdvertiserUser | None:
    user = (
        db.query(AdvertiserUser)
        .options(joinedload(AdvertiserUser.advertiser))
        .filter(AdvertiserUser.email == email.lower())
        .first()
    )
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_for_advertiser_user(user: AdvertiserUser) -> str:
    return create_advertiser_access_token(
        advertiser_user_id=user.id,
        advertiser_id=user.advertiser_id,
        email=user.email,
    )