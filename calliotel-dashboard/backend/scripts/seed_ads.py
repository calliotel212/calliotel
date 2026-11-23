#!/usr/bin/env python3
"""Seed demo AdsFind campaigns."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ads import Advertiser, Campaign

DEMO_CAMPAIGNS = [
    {
        "advertiser_name": "Demo Motors",
        "brand_name": "Demo Car Rental",
        "ad_copy": "Book a reliable car from $29/day — airport pickup and 24/7 roadside assist.",
        "destination_url": "https://example.com/demo-car-rental",
        "intent_description": (
            "car rental rent vehicle hire automobile SUV airport pickup driving transport"
        ),
        "max_cpc": "1.2500",
    },
    {
        "advertiser_name": "Demo Stay Co",
        "brand_name": "Demo Hotel",
        "ad_copy": "Weekend stays from $99 with free breakfast and late checkout.",
        "destination_url": "https://example.com/demo-hotel",
        "intent_description": "hotel room lodging stay accommodation book reservation travel",
        "max_cpc": "2.0000",
    },
    {
        "advertiser_name": "Demo Bloom",
        "brand_name": "Demo Flower Shop",
        "ad_copy": "Same-day flower delivery for birthdays, weddings, and apologies.",
        "destination_url": "https://example.com/demo-flowers",
        "intent_description": "flowers florist bouquet delivery roses gift anniversary wedding",
        "max_cpc": "0.7500",
    },
]


def seed() -> None:
    with SessionLocal() as db:
        for item in DEMO_CAMPAIGNS:
            advertiser = db.scalar(select(Advertiser).where(Advertiser.name == item["advertiser_name"]))
            if advertiser is None:
                advertiser = Advertiser(name=item["advertiser_name"], wallet_balance=1000)
                db.add(advertiser)
                db.flush()

            existing = db.scalar(
                select(Campaign).where(Campaign.brand_name == item["brand_name"])
            )
            if existing:
                continue

            db.add(
                Campaign(
                    advertiser_id=advertiser.id,
                    brand_name=item["brand_name"],
                    ad_copy=item["ad_copy"],
                    destination_url=item["destination_url"],
                    intent_description=item["intent_description"],
                    max_cpc=item["max_cpc"],
                    status="active",
                )
            )
        db.commit()
    print("Seeded demo AdsFind campaigns.")


if __name__ == "__main__":
    seed()