from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.core.security import (
    decode_access_token,
    decode_advertiser_access_token,
    decode_publisher_access_token,
)
from app.db.session import get_db
from app.models.ads import AdvertiserUser, PublisherUser
from app.models.user import User
from app.services import tenant_advertiser_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = (
        db.query(User)
        .options(joinedload(User.tenant))
        .filter(User.id == payload["sub"])
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_tenant_linked_advertiser_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdvertiserUser:
    """Tenant JWT → linked AdsFind advertiser (auto-provision on first use)."""
    return tenant_advertiser_service.get_or_link_advertiser_user(db, user=current_user)


def get_current_advertiser_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AdvertiserUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_advertiser_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = (
        db.query(AdvertiserUser)
        .options(joinedload(AdvertiserUser.advertiser))
        .filter(AdvertiserUser.id == payload["advertiser_user_id"])
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Advertiser user not found")
    return user


def get_current_publisher_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> PublisherUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_publisher_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = (
        db.query(PublisherUser)
        .options(joinedload(PublisherUser.publisher))
        .filter(PublisherUser.id == payload["publisher_user_id"])
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Publisher user not found")
    return user
