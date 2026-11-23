import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Advertiser(Base):
    __tablename__ = "advertisers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    wallet_balance: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)

    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="advertiser")


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    advertiser_id: Mapped[str] = mapped_column(String(36), ForeignKey("advertisers.id"), nullable=False)
    brand_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ad_copy: Mapped[str] = mapped_column(Text, nullable=False)
    destination_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    intent_description: Mapped[str] = mapped_column(Text, nullable=False)
    max_cpc: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
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