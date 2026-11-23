#!/usr/bin/env python3
"""Smoke test for AdsFind internal match API (semantic queries)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ.get("ADS_MATCH_URL", "http://localhost:8000/api/v1/internal/ads/match")

SEMANTIC_CASES: list[tuple[str, str]] = [
    ("I need a vehicle to drive around Beirut", "Demo Car Rental"),
    ("Where can I sleep tonight?", "Demo Hotel"),
    ("I want to buy a present for my wife", "Demo Flower Shop"),
]


def _headers() -> dict[str, str]:
    headers: dict[str, str] = {"Accept": "application/json"}
    pub_key = os.environ.get("PUBLISHER_API_KEY", "").strip()
    if pub_key:
        headers["X-Publisher-Api-Key"] = pub_key
    else:
        api_key = os.environ.get("INTERNAL_ADS_API_KEY", "").strip()
        if api_key:
            headers["X-Internal-Ads-Api-Key"] = api_key
    return headers


def match_query(query: str) -> tuple[int, dict | str]:
    params = urllib.parse.urlencode({"q": query})
    url = f"{BASE_URL}?{params}"
    req = urllib.request.Request(url, headers=_headers(), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            if body.startswith("{"):
                return resp.status, json.loads(body)
            return resp.status, body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(err_body)
        except json.JSONDecodeError:
            return e.code, err_body or f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return 0, f"Connection error: {e.reason}"


def main() -> int:
    single = os.environ.get("ADS_MATCH_QUERY", "").strip()
    cases = [(single, "")] if single else SEMANTIC_CASES

    failures = 0
    for query, expected_brand in cases:
        status, payload = match_query(query)
        print(f"\n--- Query: {query!r}")
        print(json.dumps(payload, indent=2) if isinstance(payload, dict) else payload)

        if not isinstance(payload, dict):
            failures += 1
            continue
        score = payload.get("match_score")
        brand = payload.get("brand_name", "")
        if expected_brand and brand != expected_brand:
            print(f"Expected brand {expected_brand!r}, got {brand!r}", file=sys.stderr)
            failures += 1
        elif score is not None and not (1 <= int(score) <= 10):
            print(f"match_score out of range: {score}", file=sys.stderr)
            failures += 1
        elif status != 200:
            failures += 1

    return failures


if __name__ == "__main__":
    raise SystemExit(main())