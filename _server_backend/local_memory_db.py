"""In-memory stand-in for Motor so localhost OTP can run without Mongo."""
from __future__ import annotations

from datetime import datetime, timezone


def _match(doc: dict, query: dict) -> bool:
    if not query:
        return True
    for key, expected in query.items():
        if key == "$or":
            if not any(_match(doc, part) for part in expected):
                return False
            continue
        if key == "$ne":
            continue
        actual = doc.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$gte" in expected and not (actual is not None and actual >= expected["$gte"]):
                return False
            if "$lt" in expected and not (actual is not None and actual < expected["$lt"]):
                return False
            continue
        if actual != expected:
            return False
    return True


class _UpdateResult:
    def __init__(self, n: int):
        self.modified_count = n
        self.matched_count = n


class _InsertResult:
    def __init__(self, _id):
        self.inserted_id = _id


class MemCursor:
    def __init__(self, rows, sort=None, limit=None):
        self.rows = list(rows)
        if sort:
            field, direction = sort[0]
            self.rows.sort(key=lambda d: d.get(field) or "", reverse=direction < 0)
        if limit:
            self.rows = self.rows[:limit]

    async def to_list(self, length=None):
        if length is None:
            return list(self.rows)
        return list(self.rows[:length])


class MemCollection:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if _match(doc, query):
                return dict(doc)
        return None

    async def insert_one(self, doc):
        stored = dict(doc)
        if "_id" not in stored:
            stored["_id"] = f"mem-{len(self.docs)+1}-{datetime.now(timezone.utc).timestamp()}"
        self.docs.append(stored)
        return _InsertResult(stored["_id"])

    async def update_one(self, query, update):
        for i, doc in enumerate(self.docs):
            if _match(doc, query):
                new_doc = dict(doc)
                if "$set" in update:
                    new_doc.update(update["$set"])
                self.docs[i] = new_doc
                return _UpdateResult(1)
        return _UpdateResult(0)

    async def count_documents(self, query):
        return sum(1 for d in self.docs if _match(d, query))

    def find(self, query=None, sort=None, limit=None, projection=None):
        query = query or {}
        matched = [dict(d) for d in self.docs if _match(d, query)]
        return MemCursor(matched, sort=sort, limit=limit)


class MemoryDB:
    def __init__(self):
        self._cols = {}

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._cols:
            self._cols[name] = MemCollection()
        return self._cols[name]


db = MemoryDB()
client = None
