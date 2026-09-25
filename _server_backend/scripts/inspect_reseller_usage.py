"""Read-only report: who holds reseller/developer API keys and who has used them.

Run this on the production server (where the real MongoDB and the reseller
collections live) to see the blast radius before/after disabling the reseller
API. It only reads — it never writes, bans, or deletes anything.

Usage:
  /var/www/calliotel/venv/bin/python scripts/inspect_reseller_usage.py
  /var/www/calliotel/venv/bin/python scripts/inspect_reseller_usage.py --limit 50

The reseller/developer route code is not in the public repo, so collection
names are discovered dynamically: any collection whose name looks like a
reseller / API-key / developer / usage collection is reported.
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Collection names that indicate the reseller / developer programmatic surface.
COLLECTION_PATTERNS = re.compile(
    r"(reseller|api[_-]?key|apikey|developer|api[_-]?call|api[_-]?usage|"
    r"partner|wholesale|white[_-]?label)",
    re.IGNORECASE,
)

# Field names whose values must be masked in output (never print raw secrets).
SECRET_FIELD = re.compile(r"(key|secret|token|password|hash)", re.IGNORECASE)

# Signals on a user document that the account is a reseller / API user.
USER_RESELLER_QUERY = {
    "$or": [
        {"is_reseller": True},
        {"reseller": True},
        {"role": "reseller"},
        {"reseller_id": {"$exists": True, "$ne": None}},
        {"reseller_tier": {"$exists": True, "$ne": None}},
        {"api_key": {"$exists": True, "$ne": None}},
        {"api_keys": {"$exists": True, "$ne": []}},
    ]
}


def _mask(value: object) -> object:
    s = str(value)
    if len(s) <= 8:
        return "****"
    return s[:4] + "…" + s[-2:]


def _redact(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if SECRET_FIELD.search(str(k)):
            out[k] = _mask(v)
        elif isinstance(v, dict):
            out[k] = _redact(v)
        else:
            out[k] = v
    return out


async def _sample(col, limit: int) -> list[dict]:
    """Best-effort most-recent sample; falls back to an unordered sample."""
    try:
        return await col.find({}).sort("_id", -1).limit(limit).to_list(length=limit)
    except Exception:
        try:
            return await col.find({}).to_list(length=limit)
        except Exception:
            return []


async def collect_report(db, limit: int = 20) -> dict:
    """Return a structured, read-only report of reseller/developer usage."""
    names = await db.list_collection_names()
    matched = sorted(n for n in names if COLLECTION_PATTERNS.search(n))

    collections = []
    for name in matched:
        col = db[name]
        try:
            total = await col.count_documents({})
        except Exception as e:
            collections.append({"name": name, "error": str(e)})
            continue
        sample = await _sample(col, limit)
        collections.append({
            "name": name,
            "count": total,
            "sample": [_redact(d) for d in sample],
        })

    users = {"count": 0, "emails": []}
    try:
        users["count"] = await db.users.count_documents(USER_RESELLER_QUERY)
        sample_users = await db.users.find(
            USER_RESELLER_QUERY, {"email": 1, "reseller_tier": 1, "is_reseller": 1}
        ).limit(limit).to_list(length=limit)
        users["emails"] = [
            (u.get("email") or u.get("_id"), u.get("reseller_tier")) for u in sample_users
        ]
    except Exception as e:
        users["error"] = str(e)

    return {"reseller_collections": collections, "reseller_users": users}


def render_report(report: dict) -> str:
    lines = ["", "=== Reseller / Developer API usage (read-only) ==="]

    cols = report.get("reseller_collections", [])
    if not cols:
        lines.append("No reseller/developer/api-key collections found.")
    for c in cols:
        if "error" in c:
            lines.append(f"\n[{c['name']}] error: {c['error']}")
            continue
        lines.append(f"\n[{c['name']}] {c['count']} document(s)")
        for d in c["sample"]:
            lines.append(f"    - {d}")
        if c["count"] > len(c["sample"]):
            lines.append(f"    … {c['count'] - len(c['sample'])} more not shown")

    u = report.get("reseller_users", {})
    lines.append(f"\n[users flagged as reseller / API holders] {u.get('count', 0)}")
    if u.get("error"):
        lines.append(f"    error: {u['error']}")
    for email, tier in u.get("emails", []):
        lines.append(f"    - {email}" + (f"  (tier: {tier})" if tier else ""))

    lines.append("")
    return "\n".join(lines)


async def _main(limit: int) -> None:
    from database import db

    if not hasattr(db, "list_collection_names"):
        print(
            "This backend is running the in-memory dev DB (no MONGO_URL). "
            "Run this on the production server with MONGO_URL set.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    report = await collect_report(db, limit=limit)
    print(render_report(report))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Read-only reseller/developer API usage report")
    ap.add_argument("--limit", type=int, default=20, help="max sample rows per collection")
    args = ap.parse_args()
    asyncio.run(_main(args.limit))
