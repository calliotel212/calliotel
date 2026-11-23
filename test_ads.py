#!/usr/bin/env python3
"""Smoke test for AdsFind internal match API."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ.get("ADS_MATCH_URL", "http://localhost:8000/api/v1/internal/ads/match")
QUERY = os.environ.get("ADS_MATCH_QUERY", "Do you rent cars near the airport?")


def main() -> int:
    params = urllib.parse.urlencode({"q": QUERY})
    url = f"{BASE_URL}?{params}"
    headers: dict[str, str] = {"Accept": "application/json"}
    pub_key = os.environ.get("PUBLISHER_API_KEY", "").strip()
    if pub_key:
        headers["X-Publisher-Api-Key"] = pub_key
    else:
        api_key = os.environ.get("INTERNAL_ADS_API_KEY", "").strip()
        if api_key:
            headers["X-Internal-Ads-Api-Key"] = api_key

    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            print(body)
            if body.startswith("{"):
                data = json.loads(body)
                if data.get("brand_name") == "Demo Car Rental":
                    return 0
            if "Demo Car Rental" in body:
                return 0
            return 1
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(err_body or f"HTTP {e.code}")
        return e.code
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())