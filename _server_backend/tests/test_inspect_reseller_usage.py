"""Tests for the read-only reseller/developer usage inspector."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.inspect_reseller_usage import collect_report, render_report


class _Cursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_a, **_k):
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length=None):
        return list(self._docs[:length]) if length is not None else list(self._docs)


class _Collection:
    def __init__(self, docs):
        self._docs = list(docs)

    async def count_documents(self, query):
        if not query:
            return len(self._docs)
        # Minimal $or support for the users query.
        ors = query.get("$or", [])
        return sum(1 for d in self._docs if any(_match(d, c) for c in ors))

    def find(self, query=None, projection=None):
        query = query or {}
        ors = query.get("$or")
        if ors:
            docs = [d for d in self._docs if any(_match(d, c) for c in ors)]
        else:
            docs = self._docs
        return _Cursor(docs)


def _match(doc, cond):
    for k, v in cond.items():
        if isinstance(v, dict):
            if "$exists" in v and (k in doc) != v["$exists"]:
                return False
            if "$ne" in v and doc.get(k) == v["$ne"]:
                return False
        else:
            if doc.get(k) != v:
                return False
    return True


class _FakeDB:
    def __init__(self, collections):
        self._c = {name: _Collection(docs) for name, docs in collections.items()}

    async def list_collection_names(self):
        return list(self._c.keys())

    def __getitem__(self, name):
        return self._c[name]

    def __getattr__(self, name):
        # Support db.users used by the inspector.
        c = self.__dict__.get("_c", {})
        if name in c:
            return c[name]
        raise AttributeError(name)


def test_report_finds_reseller_collections_and_masks_secrets():
    db = _FakeDB({
        "resellers": [{"_id": "r1", "email": "a@x.com", "tier": "starter"},
                      {"_id": "r2", "email": "b@x.com", "tier": "pro"}],
        "api_keys": [{"_id": "k1", "owner": "a@x.com",
                      "api_key": "live_1234567890abcdef", "secret": "supersecretvalue"}],
        "reseller_customers": [{"_id": "c1", "reseller_id": "r1"}],
        "sms_messages": [{"_id": "m1"}],  # unrelated — must be ignored
        "users": [
            {"_id": "u1", "email": "a@x.com", "is_reseller": True, "reseller_tier": "starter"},
            {"_id": "u2", "email": "normal@x.com"},
        ],
    })

    report = asyncio.run(collect_report(db, limit=10))
    names = {c["name"] for c in report["reseller_collections"]}
    assert {"resellers", "api_keys", "reseller_customers"} <= names
    assert "sms_messages" not in names

    api_keys = next(c for c in report["reseller_collections"] if c["name"] == "api_keys")
    assert api_keys["count"] == 1
    doc = api_keys["sample"][0]
    # Secret-like fields are masked, not printed raw.
    assert doc["api_key"] != "live_1234567890abcdef"
    assert "…" in doc["api_key"]
    assert doc["secret"] != "supersecretvalue"

    assert report["reseller_users"]["count"] == 1
    assert report["reseller_users"]["emails"][0][0] == "a@x.com"

    text = render_report(report)
    assert "resellers" in text
    assert "live_1234567890abcdef" not in text  # raw secret never rendered


def test_report_empty_when_no_reseller_collections():
    db = _FakeDB({"users": [{"_id": "u1", "email": "n@x.com"}], "sms_messages": []})
    report = asyncio.run(collect_report(db, limit=5))
    assert report["reseller_collections"] == []
    assert report["reseller_users"]["count"] == 0
    assert "No reseller/developer/api-key collections found." in render_report(report)
