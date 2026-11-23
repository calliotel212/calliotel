"""Heuristic detection of out-of-scope / third-party service requests."""

from __future__ import annotations

import re

_EXTERNAL_PHRASES = (
    "car rental",
    "rent a car",
    "rental car",
    "hire a car",
    "book a hotel",
    "hotel room",
    "need a hotel",
    "flower delivery",
    "send flowers",
    "florist",
    "book flowers",
    "airport pickup",
    "rent a vehicle",
    "rent a suv",
)

_WORD_RE = re.compile(r"[a-z0-9]+")


def suggests_external_service(user_text: str) -> bool:
    text = user_text.lower().strip()
    if not text:
        return False
    for phrase in _EXTERNAL_PHRASES:
        if phrase in text:
            return True
    tokens = set(_WORD_RE.findall(text))
    return bool(
        tokens
        & {
            "rental",
            "rent",
            "hotel",
            "flowers",
            "florist",
            "bouquet",
            "vehicle",
            "automobile",
            "lodging",
        }
    )