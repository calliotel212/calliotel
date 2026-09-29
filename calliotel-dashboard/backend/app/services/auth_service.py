from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    verify_password,
)
from app.models.user import Tenant, User


def signup_user(db: Session, *, email: str, password: str) -> User:
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise ValueError("Email already registered")
    tenant = Tenant(name="My Business")
    db.add(tenant)
    db.flush()
    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_for_user(user: User) -> str:
    return create_access_token(user_id=user.id, tenant_id=user.tenant_id, email=user.email)


def start_password_reset(db: Session, *, email: str) -> str | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None:
        return None
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(UTC) + timedelta(hours=1)
    db.commit()
    return token


def complete_password_reset(db: Session, *, token: str, new_password: str) -> bool:
    user = db.query(User).filter(User.reset_token == token).first()
    if user is None:
        return False
    if user.reset_token_expires_at is None or user.reset_token_expires_at < datetime.now(UTC):
        return False
    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    return True
