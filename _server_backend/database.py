"""
Shared MongoDB connection.

LOCAL_OTP_DEV=1 (or missing MONGO_URL) uses an in-memory DB so localhost
can run without production secrets.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

if os.environ.get("LOCAL_OTP_DEV") == "1" or not os.environ.get("MONGO_URL"):
    from local_memory_db import db, client
else:
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ["MONGO_URL"]
    is_atlas = "mongodb+srv" in mongo_url or "mongodb.net" in mongo_url
    client_options = {
        "serverSelectionTimeoutMS": 5000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 10000,
        "retryWrites": True,
        "retryReads": True,
    }
    if is_atlas:
        client_options["tls"] = True
    client = AsyncIOMotorClient(mongo_url, **client_options)
    db = client[os.environ.get("DB_NAME", "test_database")]
