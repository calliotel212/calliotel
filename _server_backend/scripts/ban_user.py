"""Ban or unban a Calliotel account from the server — no admin token needed.

Reuses the app's own database connection (reads MONGO_URL from the server .env),
so you just run it on the box. A banned account is locked out on its next
request ("This account has been suspended.").

Usage (on the server):
  /var/www/calliotel/venv/bin/python scripts/ban_user.py <email-or-id>
  /var/www/calliotel/venv/bin/python scripts/ban_user.py <email-or-id> --unban
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def _run(identifier: str, unban: bool) -> int:
    from database import db

    query = {"$or": [{"_id": identifier}, {"user_id": identifier}, {"email": identifier}]}
    if unban:
        res = await db.users.update_one(
            query, {"$set": {"banned": False}, "$unset": {"banned_at": "", "banned_reason": ""}}
        )
        action = "UNBANNED"
    else:
        res = await db.users.update_one(
            query,
            {"$set": {
                "banned": True,
                "banned_at": datetime.now(timezone.utc).isoformat(),
                "banned_reason": "manual CLI ban",
            }},
        )
        action = "BANNED"

    n = int(getattr(res, "modified_count", 0) or 0)
    if n:
        print(f"✅ {action}: {identifier}")
        return 0
    print(f"⚠️  No matching user found for: {identifier}")
    return 1


def main() -> int:
    args = sys.argv[1:]
    unban = "--unban" in args
    ids = [a for a in args if not a.startswith("--")]
    if not ids:
        print("Usage: python scripts/ban_user.py <email-or-id> [--unban]")
        return 2
    return asyncio.run(_run(ids[0], unban))


if __name__ == "__main__":
    sys.exit(main())
