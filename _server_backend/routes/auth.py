from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
import logging
from database import db
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
import os
import secrets
from dotenv import load_dotenv
from pathlib import Path
import string
import pyotp
import qrcode
import io
import base64

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)
router = APIRouter()

# MongoDB connection
# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
_jwt = os.environ.get("JWT_SECRET_KEY", "").strip()
if not _jwt or _jwt == "your-secret-key-change-in-production" or len(_jwt) < 32:
    raise RuntimeError("JWT_SECRET_KEY must be set to a strong secret (32+ chars) — refusing to start with a weak/default key")
SECRET_KEY = _jwt
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365 * 10  # 10 years — users stay logged in permanently

# Frontend URL — must point to calliotel.com in production
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://calliotel.com').rstrip('/')

security = HTTPBearer()

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    birthday: Optional[str] = None
    referral_code: Optional[str] = None
    terms_accepted: Optional[bool] = True
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    landing_page: Optional[str] = None
    referrer: Optional[str] = None
    
    @validator('password')
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v
    
    @validator('birthday', always=True)
    def validate_birthday(cls, v):
        # Frontend may send "" when birthday is optional/hidden — treat as unset.
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        from datetime import datetime
        try:
            birthday = datetime.fromisoformat(v)
            today = datetime.now()
            age = today.year - birthday.year
            if birthday > today:
                raise ValueError('Birthday cannot be in the future')
            if age < 13:
                raise ValueError('You must be at least 13 years old to sign up')
            if age > 120:
                raise ValueError('Invalid birth date')
            return v
        except ValueError as e:
            if 'Invalid' in str(e) or 'format' in str(e):
                raise ValueError('Birthday must be in YYYY-MM-DD format')
            raise

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    created_at: Optional[str] = ""
    email_verified: bool
    is_verified: Optional[bool] = False
    balance: Optional[float] = 0.0
    client_id: Optional[str] = None
    profile_picture: Optional[str] = None
    two_factor_enabled: Optional[bool] = False
    is_reseller: Optional[bool] = False
    reseller_status: Optional[str] = None
    parent_reseller_id: Optional[str] = None
    is_vip: Optional[bool] = False
    vip_since: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None

class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: list

class TwoFactorVerifyRequest(BaseModel):
    code: str
    secret: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    is_new_user: Optional[bool] = False  # True only when this request created a brand-new account

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class TelegramAuthRequest(BaseModel):
    """Payload returned by the Telegram Login Widget after the user authorizes."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str
    # Attribution (best-effort; same as other signup paths)
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    landing_page: Optional[str] = None
    referrer: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    access_token: Optional[str] = None
    credential: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    landing_page: Optional[str] = None
    referrer: Optional[str] = None

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

import secrets
import string

def generate_client_id() -> str:
    """Generate a unique client ID like CL12345678"""
    random_part = ''.join(secrets.choice(string.digits) for _ in range(8))
    return f"CL{random_part}"

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Step 1: decode and validate the JWT — these errors are genuine 401s
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.exceptions.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

    # Step 2: look up the user in the DB — DB/network errors are 503, not 401
    try:
        user = await db.users.find_one({"_id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DB error in get_current_user: {str(e)}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

def _client_ip(request: Request) -> str:
    """Extract real client IP, respecting Replit/proxy X-Forwarded-For chain."""
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/signup", response_model=TokenResponse)
async def signup(user_data: UserSignup, background_tasks: BackgroundTasks, request: Request):
    try:
        # Block disposable / temp-mail signups (saves ad spend on fake accounts)
        from services.disposable_emails import is_disposable_email, normalize_email
        if is_disposable_email(user_data.email):
            logger.info(f"🛡️  Blocked disposable signup: {user_data.email}")
            raise HTTPException(
                status_code=400,
                detail="Please use a real email address. Temporary or disposable email providers are not supported.",
            )

        email_lc = user_data.email.strip().lower()
        # Case-insensitive match (users often re-type with different capitalization)
        existing_user = await db.users.find_one({
            "$or": [
                {"email": email_lc},
                {"email": user_data.email},
                {"email_normalized": email_lc},
            ]
        })
        if existing_user:
            try:
                import asyncio as _asyncio
                from services.telegram_admin_alerts import notify_admins
                _asyncio.create_task(notify_admins(
                    f"⚠️ Signup failed — email already registered\n📧 {email_lc}\n🌐 IP: {_client_ip(request)}",
                    also_email=False,
                ))
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail="This email already has an account. Please log in instead.",
            )

        # Gmail alias / dot normalization: block john+spam@gmail.com if john@gmail.com exists
        normalized = normalize_email(email_lc)
        if normalized and normalized != email_lc:
            existing_normalized = await db.users.find_one({"email_normalized": normalized})
            if existing_normalized:
                logger.info(f"🛡️  Blocked Gmail alias signup: {email_lc} → {normalized}")
                raise HTTPException(
                    status_code=400,
                    detail="This email already has an account. Please log in instead.",
                )

        user_id = email_lc
        hashed_password = hash_password(user_data.password)
        
        # Generate unique client ID
        client_id = generate_client_id()
        
        # Ensure client_id is unique
        while await db.users.find_one({"client_id": client_id}):
            client_id = generate_client_id()
        
        # Referral program re-enabled 2026-06-28 — bonus only pays on first number purchase, not signup
        referred_by = None
        if user_data.referral_code:
            referrer = await db.users.find_one({"referral_code": user_data.referral_code})
            if referrer and referrer["_id"] != user_data.email:
                referred_by = referrer["_id"]
        
        # Capture IP + UA for duplicate-account detection
        signup_ip = _client_ip(request)
        signup_ua = (request.headers.get("user-agent") or "")[:500]

        # IP rate-limit: hard block if 3+ accounts from same IP in last 24 hours.
        # Shared IPs (offices, universities) may occasionally hit this — they see a
        # support message. The threshold is intentionally low because the card-verify
        # flow means legitimate users rarely need a second account.
        #
        # MONITOR_IPS (comma-separated env var): IPs used by our own E2E health-check
        # monitor are exempt from the hard block so they don't self-DOS. They are still
        # logged so we can audit the account churn.
        from datetime import timedelta as _td
        _monitor_ips: set[str] = {
            ip.strip()
            for ip in os.environ.get("MONITOR_IPS", "").split(",")
            if ip.strip()
        }
        ip_dup_flag = False
        if signup_ip:
            cutoff_24h = (datetime.now(timezone.utc) - _td(hours=24)).isoformat()
            same_ip_24h = await db.users.count_documents({
                "signup_ip": signup_ip,
                "created_at": {"$gte": cutoff_24h},
            })
            if same_ip_24h >= 3:
                if signup_ip in _monitor_ips:
                    # Our own monitor — log but allow through
                    logger.info(
                        f"ℹ️ Monitor IP {signup_ip} would be rate-limited "
                        f"({same_ip_24h} accounts in 24h) — exempted"
                    )
                else:
                    logger.warning(f"🚫 IP rate-limit hit: {signup_ip} → {same_ip_24h} accounts in 24h, blocked {user_data.email}")
                    try:
                        import asyncio as _asyncio
                        from services.telegram_admin_alerts import notify_admins
                        _asyncio.create_task(notify_admins(
                            f"🚫 Signup blocked — IP rate-limit\n📧 {user_data.email}\n🌐 IP: {signup_ip} ({same_ip_24h} accounts in 24h)\n⚠️ Client may be legit — check if support needed",
                            also_email=False,
                        ))
                    except Exception:
                        pass
                    raise HTTPException(
                        status_code=429,
                        detail="Too many accounts created from your network today. Please try again tomorrow, or contact support@calliotel.com if this is an error.",
                    )
            # Soft flag for 7-day window (for admin audit visibility)
            cutoff_7d = (datetime.now(timezone.utc) - _td(days=7)).isoformat()
            same_ip_7d = await db.users.count_documents({
                "signup_ip": signup_ip,
                "created_at": {"$gte": cutoff_7d},
            })
            if same_ip_7d >= 2:
                ip_dup_flag = True
                logger.warning(f"🚨 Multi-account flag: {user_data.email} from IP {signup_ip} ({same_ip_7d} accounts in 7d)")

        user_doc = {
            "_id": user_id,
            "email": email_lc,
            "email_normalized": normalize_email(email_lc),
            "password": hashed_password,
            "full_name": user_data.full_name,
            "username": user_data.username or email_lc.split("@")[0],
            "birthday": user_data.birthday,
            "client_id": client_id,
            "auth_provider": "email",
            "email_verified": True,  # Auto-verified — no email gate
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "signup_ip": signup_ip,
            "signup_user_agent": signup_ua,
            "ip_dup_flag": ip_dup_flag,
            "utm_source": user_data.utm_source,
            "utm_medium": user_data.utm_medium,
            "utm_campaign": user_data.utm_campaign,
            "utm_content": user_data.utm_content,
            "utm_term": user_data.utm_term,
            "landing_page": user_data.landing_page,
            "referrer": user_data.referrer,
            "terms_accepted": True,
            "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
            "terms_version": "2026-04-18",
        }
        
        # Add referral info if valid
        if referred_by:
            user_doc["referred_by"] = referred_by
            user_doc["referral_status"] = "pending"
            # Anti-abuse gate (boss directive 2026-04-21): referred users cannot
            # spend their welcome credit / referral bonus until either an admin
            # approves them OR they top up their wallet with real money.
            user_doc["requires_approval"] = True
        
        await db.users.insert_one(user_doc)
        access_token = create_access_token(data={"sub": user_id})

        # Create wallet seeded with welcome credit (drives signup → first purchase).
        # Stacks an extra referral bonus on top if the user came in via a referral code.
        from services.welcome_credit import create_wallet_with_welcome_credit
        # Boss directive 2026-04-26: ALL signup bonuses killed — was being farmed
        # ($10 referral + $1 welcome = $11/account, scammer made 28 fake accounts).
        # Wallets now start at $0.00. No exceptions.
        referral_bonus = 0.00
        new_balance = await create_wallet_with_welcome_credit(
            db,
            user_id,
            extra_credit=referral_bonus,
            extra_description=None,
        )
        
        # Send verification email in background
        from routes.email_verification import send_verification_email
        verification_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        # Store verification token
        await db.verification_tokens.insert_one({
            "email": user_data.email,
            "token": verification_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Send email in background
        background_tasks.add_task(
            send_verification_email,
            user_data.email,
            verification_token,
            user_data.full_name or "User"
        )

        # Send welcome / onboarding email in background (drives activation → first purchase)
        try:
            from services.welcome_email import send_welcome_email
            background_tasks.add_task(
                send_welcome_email,
                user_data.email,
                user_data.full_name or "User",
            )
        except Exception as _we:
            logger.warning(f"Could not enqueue welcome email for {user_data.email}: {_we}")

        logger.info(f"New user registered: {user_data.email} (Client ID: {client_id})")
        try:
            import asyncio as _asyncio
            if not user_data.email.lower().endswith("@calliotel.com"):
                from services.telegram_admin_alerts import notify_admins
                _asyncio.create_task(notify_admins(
                    f"👤 New signup\n📧 {user_data.email}\n🆔 {client_id}",
                    also_email=False,
                ))
        except Exception as _te:
            logger.warning(f"telegram alert failed (signup): {_te}")

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=user_id,
                email=user_data.email,
                full_name=user_data.full_name,
                created_at=user_doc["created_at"],
                email_verified=True,
                client_id=client_id,
                balance=new_balance,
            ),
            is_new_user=True,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        try:
            import asyncio as _asyncio
            from services.telegram_admin_alerts import notify_admins
            _asyncio.create_task(notify_admins(
                f"❌ Signup server error\n📧 {user_data.email}\n🌐 IP: {_client_ip(request)}\n🔴 Error: {str(e)[:200]}",
                also_email=False,
            ))
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to create account")
        
        logger.info(f"New user registered: {user_data.email} (Client ID: {client_id})")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=user_id,
                email=user_data.email,
                full_name=user_data.full_name,
                created_at=user_doc["created_at"],
                email_verified=True,
                client_id=client_id
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create account")

@router.post("/google", response_model=TokenResponse)
async def google_auth(data: GoogleAuthRequest):
    """Sign in / sign up with Google. Accepts either ID token (credential, preferred) or access_token."""
    import httpx
    import os as _os
    try:
        ginfo = None
        if data.credential:
            try:
                from google.oauth2 import id_token as _idtok
                from google.auth.transport import requests as _greq
                expected_aud = _os.environ.get("GOOGLE_CLIENT_ID")
                if not expected_aud:
                    raise HTTPException(status_code=500, detail="Server missing GOOGLE_CLIENT_ID")
                claims = _idtok.verify_oauth2_token(
                    data.credential, _greq.Request(), expected_aud
                )
                if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
                    raise HTTPException(status_code=401, detail="Invalid token issuer")
                if not claims.get("email_verified", False):
                    raise HTTPException(status_code=401, detail="Google email not verified")
                ginfo = {
                    "email": claims.get("email"),
                    "name": claims.get("name", ""),
                    "picture": claims.get("picture", ""),
                }
            except HTTPException:
                raise
            except Exception as ve:
                logger.warning(f"Google ID token verification failed: {ve}")
                raise HTTPException(status_code=401, detail="Invalid Google credential")
        elif data.access_token:
            expected_aud = _os.environ.get("GOOGLE_CLIENT_ID")
            if not expected_aud:
                raise HTTPException(status_code=500, detail="Server missing GOOGLE_CLIENT_ID")
            async with httpx.AsyncClient() as client:
                tinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/tokeninfo",
                    params={"access_token": data.access_token},
                    timeout=10,
                )
                if tinfo_resp.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid Google token")
                tinfo = tinfo_resp.json()
                if tinfo.get("aud") != expected_aud and tinfo.get("azp") != expected_aud:
                    logger.warning(f"Google access_token aud mismatch: aud={tinfo.get('aud')} azp={tinfo.get('azp')}")
                    raise HTTPException(status_code=401, detail="Token not issued for this application")
                if tinfo.get("email_verified") not in ("true", True):
                    raise HTTPException(status_code=401, detail="Google email not verified")
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {data.access_token}"},
                    timeout=10,
                )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            ginfo = resp.json()
        else:
            raise HTTPException(status_code=400, detail="Missing Google credential or access_token")

        email = (ginfo or {}).get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google account has no email")
        email = email.lower().strip()

        full_name = ginfo.get("name", "")
        picture = ginfo.get("picture", "")

        # Block disposable / temp-mail Google signups (only blocks NEW accounts;
        # existing users with a flagged domain are still allowed to log back in)
        from services.disposable_emails import is_disposable_email
        if is_disposable_email(email):
            existing_check = await db.users.find_one({"email": email})
            if not existing_check:
                logger.info(f"🛡️  Blocked disposable Google signup: {email}")
                raise HTTPException(
                    status_code=400,
                    detail="Please use a real email address. Temporary or disposable email providers are not supported.",
                )

        existing = await db.users.find_one({"email": email})
        is_new_user = False
        if existing:
            user_doc = existing
            if "client_id" not in user_doc:
                cid = generate_client_id()
                while await db.users.find_one({"client_id": cid}):
                    cid = generate_client_id()
                await db.users.update_one({"_id": email}, {"$set": {"client_id": cid}})
                user_doc["client_id"] = cid
        else:
            is_new_user = True
            cid = generate_client_id()
            while await db.users.find_one({"client_id": cid}):
                cid = generate_client_id()
            user_doc = {
                "_id": email,
                "email": email,
                "password": None,
                "full_name": full_name,
                "username": email.split("@")[0],
                "client_id": cid,
                "auth_provider": "google",
                "profile_picture": picture,
                "email_verified": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "terms_accepted": True,
                "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
                "terms_version": "2026-04-18",
            }
            for _f in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_page", "referrer"):
                _v = getattr(data, _f, None)
                if _v:
                    user_doc[_f] = _v[:200]
            try:
                await db.users.insert_one(user_doc)
                from services.welcome_credit import create_wallet_with_welcome_credit
                await create_wallet_with_welcome_credit(db, email)
            except Exception as ie:
                # Race condition: another concurrent request created this user. Re-fetch.
                logger.warning(f"Google signup race for {email}: {ie}; re-fetching existing user")
                existing_after_race = await db.users.find_one({"email": email})
                if not existing_after_race:
                    raise
                user_doc = existing_after_race
                # Race loser — user already existed, do NOT treat as new (avoids double welcome email + duplicate analytics)
                is_new_user = False

        access_token = create_access_token(data={"sub": email})
        wallet = await db.wallets.find_one({"user_id": email})
        balance = wallet.get("balance", 0.0) if wallet else 0.0

        # Send welcome / onboarding email — only for brand-new Google signups
        if is_new_user:
            try:
                from services.welcome_email import send_welcome_email
                import asyncio
                asyncio.create_task(asyncio.to_thread(
                    send_welcome_email, email, user_doc.get("full_name") or "there"
                ))
                logger.info(f"🎉 New Google signup: {email} — welcome email queued")
            except Exception as _we:
                logger.warning(f"Could not enqueue welcome email for {email}: {_we}")
            try:
                import asyncio as _asyncio2
                if not email.lower().endswith("@calliotel.com"):
                    from services.telegram_admin_alerts import notify_admins as _na2
                    _asyncio2.create_task(_na2(
                        f"🔵 New Google signup\n📧 {email}\n👤 {user_doc.get('full_name') or 'Unknown'}",
                        also_email=False,
                    ))
            except Exception as _te2:
                logger.warning(f"telegram alert failed (google signup): {_te2}")

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            is_new_user=is_new_user,
            user=UserResponse(
                id=email,
                email=email,
                full_name=user_doc.get("full_name"),
                username=user_doc.get("username"),
                created_at=user_doc.get("created_at", ""),
                email_verified=True,
                client_id=user_doc.get("client_id"),
                balance=balance,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Google sign-in failed")

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    try:
        email_key = user_data.email.strip().lower()
        # Indexed equality lookup (avoid $regex COLLSCAN)
        user = await db.users.find_one({"email": email_key})
        if not user:
            user = await db.users.find_one({"email_normalized": email_key})
        if not user:
            try:
                from services.disposable_emails import normalize_email
                norm = normalize_email(email_key)
            except Exception:
                norm = None
            if norm and norm != email_key:
                user = await db.users.find_one({"email_normalized": norm})
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this email.")
        
        if not verify_password(user_data.password, user["password"]):
            raise HTTPException(status_code=401, detail="Incorrect password.")

        # Banned account check
        if user.get("banned", False):
            logger.warning(f"🚫 Banned account login attempt: {user_data.email}")
            raise HTTPException(
                status_code=403,
                detail="This account has been suspended. Contact support@calliotel.com if you believe this is an error."
            )

        # Generate client_id for existing users who don't have one
        if "client_id" not in user:
            client_id = generate_client_id()
            while await db.users.find_one({"client_id": client_id}):
                client_id = generate_client_id()
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"client_id": client_id}}
            )
            user["client_id"] = client_id
        
        access_token = create_access_token(data={"sub": str(user["_id"])})
        
        logger.info(f"User logged in: {user_data.email}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=str(user["_id"]),
                email=user["email"],
                full_name=user.get("full_name"),
                created_at=user["created_at"],
                email_verified=user.get("email_verified", False),
                client_id=user.get("client_id")
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to login")

@router.get("/verify-email/{token}")
async def verify_email(token: str):
    try:
        user = await db.users.find_one({"verification_token": token})
        
        if not user:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        
        # Check if token expired
        if datetime.fromisoformat(user["verification_token_expires"]) < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Verification token has expired")
        
        # Update user as verified
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "email_verified": True,
                    "updated_at": datetime.utcnow().isoformat()
                },
                "$unset": {"verification_token": "", "verification_token_expires": ""}
            }
        )
        
        # Send welcome email
        email_service.send_welcome_email(user["email"], user.get("full_name"))
        
        logger.info(f"Email verified: {user['email']}")
        
        return {"message": "Email verified successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Verification failed")

@router.post("/resend-verification")
async def resend_verification(request: ResendVerificationRequest):
    try:
        email_key = request.email.strip().lower()
        user = await db.users.find_one({"email": email_key})
        if not user:
            user = await db.users.find_one({"email_normalized": email_key})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("email_verified"):
            raise HTTPException(status_code=400, detail="Email already verified")
        
        # Generate new token
        verification_token = generate_verification_token()
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "verification_token": verification_token,
                    "verification_token_expires": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        # Send verification email
        email_sent = email_service.send_verification_email(
            to_email=request.email,
            verification_token=verification_token,
            frontend_url=FRONTEND_URL
        )
        
        if not email_sent:
            raise HTTPException(status_code=500, detail="Failed to send verification email")
        
        logger.info(f"Verification email resent to {request.email}")
        
        return {"message": "Verification email sent"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resend verification")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    return UserResponse(
        id=current_user["_id"],
        email=current_user["email"],
        full_name=current_user.get("full_name"),
        username=current_user.get("username"),
        created_at=current_user.get("created_at", ""),
        email_verified=current_user.get("email_verified", False),
        is_verified=current_user.get("email_verified", False),
        balance=current_user.get("balance", 0.0),
        client_id=current_user.get("client_id"),
        profile_picture=current_user.get("profile_picture"),
        two_factor_enabled=current_user.get("two_factor_enabled", False),
        is_reseller=bool(current_user.get("is_reseller")),
        reseller_status=current_user.get("reseller_status"),
        parent_reseller_id=current_user.get("parent_reseller_id"),
        is_vip=bool(current_user.get("is_vip")),
        vip_since=(current_user.get("vip_since").isoformat() if hasattr(current_user.get("vip_since"), "isoformat") else current_user.get("vip_since")),
    )

@router.put("/me")
async def update_profile(request: ProfileUpdateRequest, current_user = Depends(get_current_user)):
    update_fields = {}
    if request.username is not None:
        username = request.username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        existing = await db.users.find_one({"username": username, "_id": {"$ne": current_user["_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_fields["username"] = username
    if request.full_name is not None:
        update_fields["full_name"] = request.full_name.strip()
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_fields})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return UserResponse(
        id=updated["_id"],
        email=updated["email"],
        full_name=updated.get("full_name"),
        username=updated.get("username"),
        created_at=updated["created_at"],
        email_verified=updated.get("email_verified", False),
        is_verified=updated.get("email_verified", False),
        balance=updated.get("balance", 0.0),
        client_id=updated.get("client_id"),
        profile_picture=updated.get("profile_picture"),
        two_factor_enabled=updated.get("two_factor_enabled", False)
    )

@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}

@router.delete("/account")
async def delete_account(current_user=Depends(get_current_user)):
    """
    Permanently delete the authenticated user's account and all associated data.
    Required by Apple App Store Guideline 5.1.1(v).
    """
    user_id = str(current_user["_id"])
    email   = current_user.get("email", "")
    try:
        # Delete in parallel across all collections
        import asyncio
        await asyncio.gather(
            db.users.delete_one({"_id": current_user["_id"]}),
            db.purchased_numbers.delete_many({"$or": [{"user_id": user_id}, {"user_id": current_user["_id"]}]}),
            db.user_numbers.delete_many({"user_id": user_id}),
            db.sms_messages.delete_many({"user_id": user_id}),
            db.wallet_transactions.delete_many({"user_id": user_id}),
            db.push_subscriptions.delete_many({"user_id": user_id}),
            db.referrals.delete_many({"$or": [{"referrer_id": user_id}, {"referee_id": user_id}]}),
            db.contacts.delete_many({"user_id": user_id}),
            db.scheduled_messages.delete_many({"user_id": user_id}),
            return_exceptions=True,
        )
        logger.info(f"Account deleted: {email} (id={user_id})")
        return {"message": "Account deleted successfully"}
    except Exception as e:
        logger.error(f"Account deletion error for {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user = Depends(get_current_user)):
    if not verify_password(request.current_password, current_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password": hashed, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    logger.info(f"Password changed for {current_user['email']}")
    return {"message": "Password changed successfully"}

@router.post("/2fa/setup")
async def setup_2fa(current_user = Depends(get_current_user)):
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    email = current_user["email"]
    provisioning_uri = totp.provisioning_uri(name=email, issuer_name="Calliotel")
    qr = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"totp_secret_pending": secret, "backup_codes_pending": backup_codes}}
    )
    return TwoFactorSetupResponse(secret=secret, qr_code=qr_b64, backup_codes=backup_codes)

@router.post("/2fa/enable")
async def enable_2fa(request: TwoFactorVerifyRequest, current_user = Depends(get_current_user)):
    secret = current_user.get("totp_secret_pending")
    if not secret:
        raise HTTPException(status_code=400, detail="No 2FA setup in progress. Start setup first.")
    totp = pyotp.TOTP(secret)
    if not totp.verify(request.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")
    backup_codes = current_user.get("backup_codes_pending", [])
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "totp_secret": secret,
            "two_factor_enabled": True,
            "backup_codes": backup_codes,
            "totp_secret_pending": None,
            "backup_codes_pending": None
        }}
    )
    return {"message": "Two-factor authentication enabled successfully", "backup_codes": backup_codes}

@router.post("/2fa/disable")
async def disable_2fa(request: TwoFactorVerifyRequest, current_user = Depends(get_current_user)):
    if not current_user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    secret = current_user.get("totp_secret")
    if secret:
        totp = pyotp.TOTP(secret)
        if not totp.verify(request.code, valid_window=1):
            backup_codes = current_user.get("backup_codes", [])
            if request.code.upper() not in backup_codes:
                raise HTTPException(status_code=400, detail="Invalid code")
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"two_factor_enabled": False, "totp_secret": None, "backup_codes": []}}
    )
    return {"message": "Two-factor authentication disabled"}

@router.get("/2fa/status")
async def get_2fa_status(current_user = Depends(get_current_user)):
    return {
        "enabled": current_user.get("two_factor_enabled", False),
        "has_backup_codes": len(current_user.get("backup_codes", [])) > 0
    }

# ─────────────────────────────────────────────────────────────────────────────
# TELEGRAM LOGIN — 100% free phone-less auth via Telegram Login Widget
# ─────────────────────────────────────────────────────────────────────────────
def _verify_telegram_payload(data: dict, bot_token: str, max_age_seconds: int = 300) -> bool:
    """
    Verify the cryptographic signature returned by Telegram's Login Widget.
    Per https://core.telegram.org/widgets/login#checking-authorization
    """
    import hashlib, hmac, time
    received_hash = data.get("hash")
    if not received_hash or not bot_token:
        return False
    # Build data_check_string: all fields except `hash`, sorted alphabetically as `key=value`, joined by \n
    pairs = []
    for k in sorted(data.keys()):
        if k == "hash":
            continue
        v = data[k]
        if v is None:
            continue
        pairs.append(f"{k}={v}")
    data_check_string = "\n".join(pairs)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed_hash, received_hash):
        return False
    # Reject stale OR future-dated payloads (replay protection)
    auth_date = data.get("auth_date")
    if auth_date is None:
        return False
    now = int(time.time())
    age = now - int(auth_date)
    if age > max_age_seconds or age < -60:  # allow 60s clock skew toward future
        return False
    return True


async def _finish_telegram_user(
    *,
    telegram_id: int,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    photo_url: Optional[str] = None,
    extra: Optional[dict] = None,
) -> TokenResponse:
    """Create or sign in a Calliotel user from a verified Telegram identity."""
    extra = extra or {}
    full_name = (f"{first_name or ''} {last_name or ''}").strip() or (username or f"User{telegram_id}")

    try:
        await db.users.create_index("telegram_id", unique=True, sparse=True, name="uniq_telegram_id")
    except Exception as _ie:
        logger.debug(f"telegram_id index already exists or could not be created: {_ie}")

    existing = await db.users.find_one({"telegram_id": telegram_id})
    is_new_user = False

    if existing:
        user_doc = existing
        await db.users.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {
                "full_name": user_doc.get("full_name") or full_name,
                "profile_picture": photo_url or user_doc.get("profile_picture"),
                "telegram_username": username or user_doc.get("telegram_username"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        user_id_for_token = user_doc["_id"]
    else:
        is_new_user = True
        base_synthetic = f"tg{telegram_id}@telegram.calliotel.user"
        synthetic_email = base_synthetic
        suffix = 0
        while await db.users.find_one({"_id": synthetic_email}):
            suffix += 1
            synthetic_email = f"tg{telegram_id}+{suffix}@telegram.calliotel.user"
            if suffix > 5:
                logger.error(f"Could not allocate synthetic email for tg_id={telegram_id}")
                raise HTTPException(status_code=500, detail="Account setup failed. Please contact support.")
        user_id_for_token = synthetic_email

        cid = generate_client_id()
        while await db.users.find_one({"client_id": cid}):
            cid = generate_client_id()

        user_doc = {
            "_id": synthetic_email,
            "email": synthetic_email,
            "password": None,
            "full_name": full_name,
            "username": username or f"tg_{telegram_id}",
            "client_id": cid,
            "auth_provider": "telegram",
            "telegram_id": telegram_id,
            "telegram_username": username,
            "profile_picture": photo_url,
            "email_verified": False,
            "needs_real_email": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "terms_accepted": True,
            "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
            "terms_version": "2026-04-18",
        }
        for _f in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_page", "referrer"):
            _v = extra.get(_f)
            if _v:
                user_doc[_f] = str(_v)[:200]

        try:
            await db.users.insert_one(user_doc)
            from services.welcome_credit import create_wallet_with_welcome_credit
            await create_wallet_with_welcome_credit(db, synthetic_email)
            logger.info(f"🆕 New Telegram signup: tg_id={telegram_id} username=@{username}")
        except Exception as ie:
            logger.warning(f"Telegram signup race for tg_id={telegram_id}: {ie}; re-fetching")
            existing_after = await db.users.find_one({"telegram_id": telegram_id})
            if not existing_after:
                raise
            user_doc = existing_after
            user_id_for_token = user_doc["_id"]
            is_new_user = False

    access_token = create_access_token(data={"sub": user_id_for_token})
    wallet = await db.wallets.find_one({"user_id": user_id_for_token})
    balance = wallet.get("balance", 0.0) if wallet else 0.0

    user_response = UserResponse(
        id=user_doc["_id"],
        email=user_doc.get("email", ""),
        full_name=user_doc.get("full_name"),
        username=user_doc.get("username"),
        client_id=user_doc.get("client_id"),
        balance=balance,
        is_admin=user_doc.get("is_admin", False),
        email_verified=user_doc.get("email_verified", False),
        profile_picture=user_doc.get("profile_picture"),
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
        is_new_user=is_new_user,
    )


def _verify_telegram_webapp_init_data(init_data: str, bot_token: str, max_age_seconds: int = 86400) -> Optional[dict]:
    """Validate Mini App initData. Secret is HMAC-SHA256(bot_token, key=WebAppData)."""
    import hashlib, hmac, time, json
    from urllib.parse import parse_qsl
    if not init_data or not bot_token:
        return None
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, received_hash):
        return None
    try:
        auth_date = int(parsed.get("auth_date") or 0)
    except (TypeError, ValueError):
        return None
    now = int(time.time())
    age = now - auth_date
    if age > max_age_seconds or age < -60:
        return None
    user_raw = parsed.get("user")
    if not user_raw:
        return None
    try:
        user = json.loads(user_raw)
    except Exception:
        return None
    if not user.get("id"):
        return None
    return user


@router.post("/telegram", response_model=TokenResponse)
async def telegram_auth(data: TelegramAuthRequest, background_tasks: BackgroundTasks):
    """
    Authenticate a user via the Telegram Login Widget.
    Verifies the HMAC-SHA256 signature, then signs in the existing account
    or creates a new one. Telegram users do not have an email by default —
    we generate a placeholder so they can later add a real email in settings.
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        logger.error("TELEGRAM_BOT_TOKEN not configured")
        raise HTTPException(status_code=500, detail="Telegram login is not configured.")

    payload = data.dict(exclude_none=True)
    # Strip our own attribution fields before signature check
    auth_only = {k: v for k, v in payload.items() if k in {
        "id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"
    }}
    if not _verify_telegram_payload(auth_only, bot_token):
        logger.warning(f"🚫 Telegram signature mismatch for tg_id={data.id}")
        raise HTTPException(status_code=401, detail="Invalid Telegram authorization. Please try again.")

    extra = {k: payload.get(k) for k in (
        "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_page", "referrer"
    ) if payload.get(k)}
    return await _finish_telegram_user(
        telegram_id=int(data.id),
        first_name=data.first_name,
        last_name=data.last_name,
        username=data.username,
        photo_url=data.photo_url,
        extra=extra,
    )


class TelegramWebAppRequest(BaseModel):
    init_data: str
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    landing_page: Optional[str] = None
    referrer: Optional[str] = None


@router.post("/telegram-webapp", response_model=TokenResponse)
async def telegram_webapp_auth(data: TelegramWebAppRequest):
    """Sign in from the Telegram Mini App using initData (different HMAC than the Login Widget)."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        raise HTTPException(status_code=500, detail="Telegram login is not configured.")
    user = _verify_telegram_webapp_init_data((data.init_data or "").strip(), bot_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Telegram Mini App session. Open Calliotel from the bot.")
    extra = {k: getattr(data, k) for k in (
        "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_page", "referrer"
    ) if getattr(data, k, None)}
    return await _finish_telegram_user(
        telegram_id=int(user["id"]),
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        username=user.get("username"),
        photo_url=user.get("photo_url"),
        extra=extra,
    )
