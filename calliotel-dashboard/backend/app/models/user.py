import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), default="My Business")
    agent_status: Mapped[str] = mapped_column(String(32), default="offline")
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activation_status: Mapped[str] = mapped_column(String(32), default="inactive")
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    calls_this_month: Mapped[int] = mapped_column(default=0)
    minutes_used: Mapped[int] = mapped_column(default=0)
    billing_status: Mapped[str] = mapped_column(String(32), default="trial")
    business_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    business_hours: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    business_services: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_faq: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    agent_voice: Mapped[str] = mapped_column(String(16), default="female")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    reset_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
