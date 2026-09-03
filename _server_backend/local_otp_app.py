"""
Localhost-only API for the one-time OTP page.

Dummy login + in-memory wallet. Real North SMS catalog (guest). Mock number
until NORTHSMS_API_TOKEN is set. Do not deploy this file.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent
os.environ["LOCAL_OTP_DEV"] = "1"
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "calliotel-local-otp-dev-secret-key-32chars",
)
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")
os.environ["LOCAL_OTP_DEV"] = "1"

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import jwt

from database import db
from routes.auth_deps import get_current_user
from routes.fivesim_otp import router as otp_router, SELL_PRICE

app = FastAPI(title="Calliotel local OTP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(otp_router, prefix="/api/one-otp", tags=["One-time OTP $1"])

LOCAL_BALANCE = 20.0
SECRET = os.environ["JWT_SECRET_KEY"]


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _user_payload(email: str) -> dict:
    return {
        "id": email,
        "email": email,
        "full_name": "Local OTP tester",
        "username": email.split("@")[0],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "email_verified": True,
        "is_verified": True,
        "balance": LOCAL_BALANCE,
        "client_id": "LOCAL",
    }


async def _ensure_user(email: str) -> dict:
    email = email.strip().lower()
    user = await db.users.find_one({"_id": email})
    if not user:
        user = {
            "_id": email,
            "email": email,
            "full_name": "Local OTP tester",
            "email_verified": True,
        }
        await db.users.insert_one(user)
    wallet = await db.wallets.find_one({"user_id": email})
    if not wallet:
        await db.wallets.insert_one({
            "user_id": email,
            "balance": LOCAL_BALANCE,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return user


@app.get("/api/health")
async def health():
    return {"status": "alive", "service": "calliotel-local-otp", "demo": True}


@app.post("/api/auth/login")
async def login(body: LoginBody):
    if len(body.password) < 1:
        raise HTTPException(status_code=401, detail="Password required")
    email = body.email.strip().lower()
    await _ensure_user(email)
    token = jwt.encode({"sub": email}, SECRET, algorithm="HS256")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_payload(email),
        "is_new_user": False,
    }


@app.post("/api/auth/signup")
async def signup(body: LoginBody):
    return await login(body)


@app.get("/api/auth/me")
async def me(current_user=Depends(get_current_user)):
    email = current_user.get("email") or current_user["_id"]
    await _ensure_user(email)
    return _user_payload(email)


@app.get("/api/wallet/balance")
async def wallet_balance(current_user=Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": current_user["_id"]})
    return {"balance": float(wallet.get("balance", 0)) if wallet else 0.0}
