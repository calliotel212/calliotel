#!/usr/bin/env python3
"""Print active AdsFind campaigns; exit 1 if none."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ads import Campaign

SERVABLE = frozenset({"active"})


def main() -> int:
    with SessionLocal() as db:
        campaigns = db.scalars(select(Campaign).where(Campaign.status.in_(SERVABLE))).all()
    if not campaigns:
        print("No active campaigns. Run: python3 scripts/seed_ads.py", file=sys.stderr)
        return 1
    for c in campaigns:
        print(f"{c.brand_name}\tstatus={c.status}\tid={c.id}")
    print(f"Total active: {len(campaigns)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())