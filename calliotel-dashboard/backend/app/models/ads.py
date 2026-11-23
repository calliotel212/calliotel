import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Advertiser(Base):
    __tablename__ = "advertisers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    wallet_balance: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)

    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="advertiser")
    users: Mapped[list["AdvertiserUser"]] = relationship(back_populates="advertiser")


class AdvertiserUser(Base):
    __tablename__ = "advertiser_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    advertiser_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisers.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    advertiser: Mapped["Advertiser"] = relationship(back_populates="users")


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    advertiser_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisers.id"), nullable=False)
    brand_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ad_copy: Mapped[str] = mapped_column(Text, nullable=False)
    destination_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    intent_description: Mapped[str] = mapped_column(Text, nullable=False)
    max_cpc: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    daily_budget: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    # Empty arrays mean no filter — campaign is eligible for all countries/languages.
    target_countries: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    target_languages: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")

    advertiser: Mapped["Advertiser"] = relationship(back_populates="campaigns")
    events: Mapped[list["AdEvent"]] = relationship(back_populates="campaign")


class AdEvent(Base):
    __tablename__ = "ad_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id: Mapped[str] = mapped_column(String(36), ForeignKey("campaigns.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign: Mapped["Campaign"] = relationship(back_populates="events")


class Publisher(Base):
    __tablename__ = "publishers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    pending_balance: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    paid_balance: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    revenue_share_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=70.0)
    api_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    api_key_last4: Mapped[str] = mapped_column(String(4), nullable=False, default="")

    users: Mapped[list["PublisherUser"]] = relationship(back_populates="publisher")
    events: Mapped[list["PublisherEvent"]] = relationship(back_populates="publisher")


class PublisherUser(Base):
    __tablename__ = "publisher_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    publisher_id: Mapped[str] = mapped_column(String(36), ForeignKey("publishers.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    publisher: Mapped["Publisher"] = relationship(back_populates="users")


class PublisherEvent(Base):
    __tablename__ = "publisher_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    publisher_id: Mapped[str] = mapped_column(String(36), ForeignKey("publishers.id"), nullable=False)
    campaign_id: Mapped[str] = mapped_column(String(36), ForeignKey("campaigns.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # Mock earnings until wallet/settlement ships: max_cpc * revenue_share_percentage / 100.
    revenue_amount: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    publisher: Mapped["Publisher"] = relationship(back_populates="events")
    campaign: Mapped["Campaign"] = relationship()