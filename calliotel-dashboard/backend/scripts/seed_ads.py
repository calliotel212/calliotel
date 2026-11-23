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
            "Car rental and vehicle hire for driving around cities like Beirut. "
            "Rent automobiles, SUVs, and airport pickup transport."
        ),
        "max_cpc": "1.2500",
    },
    {
        "advertiser_name": "Demo Stay Co",
        "brand_name": "Demo Hotel",
        "ad_copy": "Weekend stays from $99 with free breakfast and late checkout.",
        "destination_url": "https://example.com/demo-hotel",
        "intent_description": (
            "Hotel rooms and lodging for travelers who need a place to sleep tonight. "
            "Book accommodation, stays, and reservations."
        ),
        "max_cpc": "2.0000",
    },
    {
        "advertiser_name": "Demo Bloom",
        "brand_name": "Demo Flower Shop",
        "ad_copy": "Same-day flower delivery for birthdays, weddings, and apologies.",
        "destination_url": "https://example.com/demo-flowers",
        "intent_description": (
            "Florist and flower shop for gifts and presents — bouquets, roses, anniversaries, "
            "and surprises for partners and spouses."
        ),
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
                existing.intent_description = item["intent_description"]
                existing.ad_copy = item["ad_copy"]
                existing.status = "active"
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