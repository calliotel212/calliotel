from fastapi import FastAPI, APIRouter, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Pre-declared — set to True later only if frontend/build/static exists at startup
_FRONTEND_STATIC_MOUNTED = False
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging for production (Kubernetes-friendly)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # Output to stdout for K8s log collection
    ]
)
logger = logging.getLogger(__name__)

# Import shared MongoDB client and database
from database import client, db

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize background scheduler
    logger.info("🚀 Starting Calliotel backend...")
    
    # Verify MongoDB connection before starting scheduler
    try:
        # Ping database to ensure connection is alive
        await client.admin.command('ping')
        logger.info(f"✅ MongoDB connected: {os.environ.get('DB_NAME', 'default')}")
        # Ensure hot-path indexes (idempotent; never blocks boot on failure)
        try:
            from scripts.ensure_indexes import ensure_indexes
            idx_summary = await ensure_indexes()
            logger.info(
                f"✅ Indexes ready: {len(idx_summary.get('indexes', []))} ok, "
                f"{len(idx_summary.get('errors', []))} skipped, "
                f"email_normalized backfill={idx_summary.get('backfill_email_normalized', 0)}"
            )
        except Exception as idx_err:
            logger.warning(f"⚠️ Index ensure skipped: {idx_err}")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {str(e)}")
        # Continue startup even if MongoDB is temporarily unavailable
    
    # Capture the main event loop so APScheduler thread wrappers can use it
    try:
        import asyncio as _asyncio
        from services.billing_jobs import set_main_loop
        set_main_loop(_asyncio.get_event_loop())
    except Exception as e:
        logger.warning(f"⚠️ Could not capture main event loop: {e}")

    # Start background scheduler in non-blocking mode
    try:
        from services.scheduler import start_scheduler
        scheduler_started = start_scheduler()
        if scheduler_started:
            logger.info("✅ Background job scheduler initialized")
        else:
            logger.warning("⚠️ Background job scheduler failed to start")
    except Exception as e:
        logger.error(f"❌ Error starting scheduler: {str(e)}")
    
    # Telnyx: no trunk assignment needed — voice + SMS are fully automatic.
    # (DIDWW trunk verification removed 2026-05-22 — provider replaced by Telnyx)

    # Telnyx webhook verification readiness (fail-closed guard). Warn loudly if
    # TELNYX_PUBLIC_KEY or PyNaCl is missing, since that rejects every Telnyx
    # call webhook and breaks legitimate call billing.
    try:
        from services.telnyx_webhook_verify import log_config_status as _telnyx_verify_status
        _telnyx_verify_status(logger)
    except Exception as e:
        logger.warning(f"⚠️ Telnyx webhook verify status check skipped: {e}")

    # Email blast retry scheduler (resumes after Resend daily quota reset)
    try:
        import asyncio as _asyncio
        from scripts.scheduled_email_retry import main as _email_retry_main
        _asyncio.create_task(_email_retry_main())
        logger.info("✅ Email blast retry scheduler launched")
    except Exception as e:
        logger.warning(f"⚠️ Email retry scheduler skipped: {e}")

    # USDT blockchain payment monitor
    try:
        import asyncio as _asyncio
        from routes.usdt_payments import monitor_usdt_payments
        _asyncio.create_task(monitor_usdt_payments())
        logger.info("✅ USDT payment monitor launched")
    except Exception as e:
        logger.warning(f"⚠️ USDT monitor skipped: {e}")

    # Signal that startup is complete (important for K8s readiness probe)
    logger.info("✅ Calliotel backend startup complete - ready to serve requests")
    
    yield
    
    # Shutdown: Stop background scheduler
    logger.info("⏹️ Shutting down Calliotel backend...")
    try:
        from services.scheduler import stop_scheduler
        stop_scheduler()
        logger.info("✅ Background job scheduler stopped")
    except Exception as e:
        logger.error(f"❌ Error stopping scheduler: {str(e)}")
    
    # Close MongoDB connection
    client.close()
    logger.info("✅ MongoDB connection closed")

# Create the main app without a prefix
_docs_on = os.environ.get("ENABLE_API_DOCS") == "1"
app = FastAPI(
    lifespan=lifespan,
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)

def _include_optional(module_name, **kwargs):
    """Mount a router. Import failures must never take down signup/login."""
    try:
        import importlib
        mod = importlib.import_module(module_name)
        app.include_router(mod.router, **kwargs)
        return mod
    except Exception as e:
        logger.error(
            "Optional router %s failed to load: %s — signup/login stay up",
            module_name, e,
        )
        return None

# Enable GZip compression for all text responses (HTML, JSON, CSS, JS)
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Import Error Filter Middleware (WHITE-LABEL PROTECTION)
from middleware.error_filter import ErrorFilterMiddleware

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    """Root endpoint - instant response for K8s probes"""
    return {"message": "Fortress Active", "status": "operational"}

@api_router.head("/health")
@api_router.head("/healthz")
@api_router.head("/ping")
@api_router.get("/ping")
@api_router.get("/health")
@api_router.get("/healthz")
async def health_check():
    """
    ULTRA-FAST health check - NO database calls
    Returns immediately (<10ms) for K8s health probes
    Use /health/full for detailed check including database
    """
    if not _FRONTEND_STATIC_MOUNTED:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "calliotel-backend",
                "version": "1.0.0",
                "error": "Frontend static files NOT mounted — site is broken. Run yarn build then restart API."
            }
        )
    return {
        "status": "alive",
        "service": "calliotel-backend",
        "version": "1.0.0"
    }

@api_router.get("/health/full")
async def health_check_full():
    """
    Full health check with database ping
    Use this for detailed diagnostics, not for K8s probes
    """
    health_status = {
        "status": "healthy",
        "service": "calliotel-backend",
        "version": "1.0.0"
    }
    
    # Quick database ping (non-blocking with timeout)
    try:
        await client.admin.command('ping', maxTimeMS=1000)
        health_status["database"] = "connected"
    except Exception as e:
        # Don't fail health check if DB is slow, just report status
        health_status["database"] = "timeout"
        logger.warning(f"Health check: DB ping timeout - {str(e)}")
    
    return health_status

@api_router.get("/readiness")
async def readiness_check():
    """
    Kubernetes readiness probe - INSTANT response
    Confirms app is ready to serve traffic
    """
    return {"ready": True}

@api_router.get("/liveness")
async def liveness_check():
    """
    Kubernetes liveness probe - INSTANT response
    Confirms app is still alive
    """
    return {"alive": True}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

@app.get("/health")
async def true_health():
    """Root-level health check (no /api prefix)"""
    return {"status": "alive", "service": "calliotel"}

# Include authentication router
from routes import auth
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# Include number management router
from routes import number_management
app.include_router(number_management.router, prefix="/api/numbers", tags=["Number Management"])

# Include SMS router
from routes import sms
app.include_router(sms.router, prefix="/api/sms", tags=["SMS"])

# Include wallet router
from routes import wallet
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])

# Include Emergent Auth router
from routes import emergent_auth
app.include_router(emergent_auth.router, prefix="/api/auth/emergent", tags=["Emergent OAuth"])

# Include Email Verification router
from routes import email_verification
app.include_router(email_verification.router, prefix="/api/email", tags=["Email Verification"])

# Include Payments router
from routes import payments
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])

from routes import usdt_payments
app.include_router(usdt_payments.router, prefix="/api/payments/usdt", tags=["USDT Payments"])

from routes import nowpayments_routes
app.include_router(nowpayments_routes.router, prefix="/api/payments/nowpayments", tags=["NOWPayments Crypto"])

_include_optional("routes.bekena_routes", prefix="/api/payments/bekena", tags=["Bekena USDT"])
_include_optional("routes.fincra_routes", prefix="/api/payments/fincra", tags=["Fincra Naira"])

from routes import stripe_routes
app.include_router(stripe_routes.router, prefix="/api/payments/stripe", tags=["Stripe Card"])

from routes import affirm_routes
app.include_router(affirm_routes.router, prefix="/api/payments/affirm", tags=["Affirm BNPL"])

# Viva Wallet removed — using Stripe (card) + NOWPayments (crypto) only
from routes import twocheckout_routes
app.include_router(twocheckout_routes.router, prefix="/api/payments/twocheckout", tags=["2Checkout"])



# Include Telecom router (NEW - Integrated Backend!)
from routes import telecom
app.include_router(telecom.router)

# Include Telnyx Virtual Numbers router (PRIMARY PROVIDER — full voice + SMS)
# Mounted at /api/didww — frontend path kept for compatibility.
from routes import telnyx_routes
app.include_router(telnyx_routes.router, prefix="/api/didww", tags=["Telnyx Virtual Numbers"])
from routes import calls
app.include_router(calls.router, prefix="/api/calls", tags=["Voice Calls"])

# Admin: cross-provider balance dashboard
from routes import admin_balances
app.include_router(admin_balances.router, prefix="/api/admin", tags=["Admin: Provider Balances"])

from routes import custom_number_requests
app.include_router(custom_number_requests.router, prefix="/api/custom-numbers", tags=["Custom Number Requests"])

# Sinch / Telnyx features removed 2026-04-24 — providers cancelled,
# zero customer adoption (sinch_routes, lookup, sms_campaigns, voice_forwarding,
# verify_api, sip_trunking). Customer-facing equivalents remain via
# Virtual numbers (Telnyx).

# Include Number Pool router (Calliotel's own managed number inventory)
from routes import number_pool
app.include_router(number_pool.router, prefix="/api", tags=["Number Pool"])

# Include Contacts router
from routes import contacts
app.include_router(contacts.router, prefix="/api/contacts", tags=["Contacts"])

# Include Referrals router
from routes import referrals
app.include_router(referrals.router, prefix="/api/referrals", tags=["Referrals"])

from routes import promo_codes
app.include_router(promo_codes.router, prefix="/api/promo", tags=["Promo Codes"])

# Admin Telegram must remain optional so a missing broadcast module can never
# take signup, login, payments, or the core API offline.
_include_optional(
    "routes.admin_telegram",
    prefix="/api/admin/telegram",
    tags=["Admin Telegram Broadcast"],
)

# Include Chat router
from routes import chat
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

# Include SMS Automation router
from routes import sms_automation
app.include_router(sms_automation.router, prefix="/api/sms-automation", tags=["SMS Automation"])

# Include Analytics router
from routes import analytics
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

# Include WhatsApp Business webhook + AI auto-reply
from routes import whatsapp as whatsapp_routes
app.include_router(whatsapp_routes.router, prefix="/api/whatsapp", tags=["WhatsApp"])

from routes import whatsapp_business as whatsapp_business_routes
app.include_router(whatsapp_business_routes.router)

from routes import vip_concierge as vip_concierge_routes
app.include_router(vip_concierge_routes.router, prefix="/api/vip", tags=["VIP Concierge"])

from routes import sms_automation

# Include Gamification router
from routes import gamification
app.include_router(gamification.router, prefix="/api/gamification", tags=["Gamification"])

# Include Speed Dialer Game router
from routes import speed_dialer
app.include_router(speed_dialer.router, prefix="/api/game/speed-dialer", tags=["Speed Dialer Game"])

# Include Duel System router
from routes import duel
app.include_router(duel.router, prefix="/api/game/duel", tags=["Duel System"])

# Include Phish-Finder Game router
from routes import phish_finder
app.include_router(phish_finder.router, prefix="/api/game/phish-finder", tags=["Phish-Finder Game"])

# Include Game Challenges router (Chat-to-Game Bridge)
from routes import game_challenges
app.include_router(game_challenges.router, prefix="/api/game/challenge", tags=["Game Challenges"])

# Include Profile Management router (Combat Card, Avatar, Mood)
from routes import profile
app.include_router(profile.router, prefix="/api/profile", tags=["Profile Management"])

# Include Co-Op Stack Game router
from routes import coop_stack
app.include_router(coop_stack.router, prefix="/api/coop", tags=["Co-Op Stack Game"])

# Include Leaderboard router
from routes import leaderboard
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard - Hall of Legends"])

# Include Global Square router
from routes import global_square
app.include_router(global_square.router, prefix="/api/global-square", tags=["Global Square - Social Layer"])


# Include Co-Op Stack router (Multiplayer Game)
from routes import coop_stack

# Include Spam Protection router
from routes import spam_protection
app.include_router(spam_protection.router, prefix="/api/spam", tags=["Spam Protection"])

# Include Public API router
from routes import public_api
app.include_router(public_api.router, prefix="/api/public-api", tags=["Public API"])

from routes import public_inventory
app.include_router(public_inventory.router, prefix="/api/public/inventory", tags=["Public Inventory"])

# Include AI Assistant router
from routes import ai_assistant
app.include_router(ai_assistant.router, prefix="/api/ai", tags=["AI Assistant"])

# Include Teams router
from routes import teams
app.include_router(teams.router, prefix="/api/teams", tags=["Team Accounts"])

# Voicemail router removed 2026-04-24 — Telnyx-based, zero customer adoption.

# Include Birthday Feature router
from routes import birthdays
app.include_router(birthdays.router, prefix="/api/birthdays", tags=["Birthday Features"])

# Include Webhooks router
from routes import webhooks
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])

# Include support chat router
from routes import support_chat
app.include_router(support_chat.router, prefix="/api/support", tags=["Support Chat"])

# Include privacy settings router
from routes import privacy_settings

# Include premium numbers router
from routes import premium_numbers
app.include_router(premium_numbers.router, prefix="/api", tags=["Premium Numbers"])

# Include credit packages router

# Include reseller API router
from routes import reseller_api

app.include_router(reseller_api.router, prefix="/api", tags=["Reseller API"])

from routes import reseller_v2

app.include_router(reseller_v2.router, prefix="/api/reseller", tags=["Reseller V2 (White-Label)"])

from routes import credit_packages
app.include_router(credit_packages.router, prefix="/api", tags=["Credit Packages"])

app.include_router(privacy_settings.router, prefix="/api/settings", tags=["Privacy Settings"])



# Include Notifications router
from routes import notifications
app.include_router(notifications.router, prefix="/api/notifications", tags=["Broadcast Notifications"])

# Include Daily Challenges router
from routes import daily_challenges
app.include_router(daily_challenges.router, prefix="/api/challenges", tags=["Daily Challenges"])

# Include Trust Stats router
from routes import trust_stats
app.include_router(trust_stats.router, prefix="/api/stats", tags=["Trust Stats"])

# Include Coverage router
from routes import coverage
app.include_router(coverage.router, prefix="/api", tags=["Coverage"])

# Include Live Numbers router
from routes import live_numbers
app.include_router(live_numbers.router, prefix="/api", tags=["Live Numbers"])


# Include Password Reset router
from routes import password_reset

# Include Streak System router
from routes import streaks

# Include Media Upload router
from routes import media

# Include Chat Stats router
from routes import chat_stats

# Include Chat Wrapped router
from routes import chat_wrapped

# Include Channels router
from routes import channels

# Include Posts router
from routes import posts

# Include Feed router
from routes import feed

# Include Stories router
from routes import stories

# Include Notification Settings router
from routes import notification_settings

# Include Push Notifications router
from routes import push_notifications

# Include Theme Settings router
from routes import theme_settings

# Include Voice Notes router
from routes import voice_notes

app.include_router(media.router, prefix="/api/media", tags=["Media & Stickers"])
app.include_router(chat_stats.router, prefix="/api/chat", tags=["Chat Statistics"])
app.include_router(chat_wrapped.router, prefix="/api/wrapped", tags=["Chat Wrapped"])
app.include_router(channels.router, prefix="/api/channels", tags=["Channels"])
app.include_router(posts.router, prefix="/api/posts", tags=["Posts & Feed"])
app.include_router(feed.router, prefix="/api/feed", tags=["Intelligent Feed"])

# Serve static media files
from fastapi.staticfiles import StaticFiles
import pathlib
_media_dir = pathlib.Path(__file__).parent / "media"
_media_dir.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_media_dir)), name="media")

app.include_router(streaks.router, prefix="/api/streaks", tags=["Streak System"])
app.include_router(stories.router, prefix="/api/stories", tags=["Stories Feature"])
app.include_router(notification_settings.router, prefix="/api/notifications/settings", tags=["Notification Settings"])
app.include_router(push_notifications.router, prefix="/api/push", tags=["Push Notifications"])
app.include_router(theme_settings.router, prefix="/api/theme", tags=["Theme Settings"])
app.include_router(voice_notes.router, prefix="/api/voice", tags=["Voice Notes"])

# AI Features (Smart Replies, Translation) - mounted at /api/ai-chat to avoid conflict with /api/ai
from routes import ai_features
app.include_router(ai_features.router, prefix="/api/ai-chat", tags=["AI Chat Features"])


app.include_router(password_reset.router, prefix="/api/password", tags=["Password Reset"])

# Include Number Intelligence router
from routes import number_intelligence
app.include_router(number_intelligence.router, prefix="/api/number-intelligence", tags=["Number Intelligence"])

# Optional routers — a broken job/admin/OTP module must not kill signup/login
_include_optional("routes.admin_jobs", prefix="/api/admin/jobs", tags=["Admin - Background Jobs"])
_include_optional("routes.admin_cleanup", prefix="/api/admin/cleanup", tags=["Admin - Cleanup Jobs"])
_include_optional("routes.scheduled_messages", prefix="/api/scheduled-messages", tags=["Scheduled Messages"])
_include_optional("routes.video_reactions", prefix="/api/video-reactions", tags=["Video Reactions & Views"])
_include_optional("routes.admin", prefix="/api/admin", tags=["Admin"])
_include_optional("routes.support_tickets", prefix="/api/support", tags=["Support Tickets"])
_include_optional("routes.time_machine", prefix="/api/time-machine", tags=["Time Machine"])
_include_optional("routes.video_chat", prefix="/api/video-chat", tags=["Video Chat"])
_include_optional("routes.live_streaming", prefix="/api/live-streaming", tags=["Live Streaming"])
_include_optional("routes.avatar_creator", prefix="/api/avatar-creator", tags=["3D Avatars"])
_include_optional("routes.hologram_messages", prefix="/api/hologram-messages", tags=["Hologram Messages"])
_include_optional("routes.kids_mode", prefix="/api/kids-mode", tags=["Kids Mode"])
_include_optional("routes.video_render", prefix="/api", tags=["Video Render"])
_include_optional("routes.herosms_routes", prefix="/api/otp", tags=["OTP Numbers"])
_include_optional("routes.fivesim_otp", prefix="/api/one-otp", tags=["One-time OTP $1"])
_include_optional("routes.proxy_routes", prefix="/api/proxy", tags=["Customer Proxy"])
_include_optional("routes.telegram_miniapp", prefix="/api/telegram/miniapp", tags=["Telegram Mini App"])

from fastapi.responses import FileResponse as _FileResponse
import os as _os
@app.get("/api/dl/aab", include_in_schema=False)
async def download_aab():
    _aab = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "calliotel-v1.0.1-tiktok-signed.aab"))
    if not _os.path.exists(_aab):
        from fastapi import HTTPException as _H
        raise _H(404, "File not found")
    return _FileResponse(_aab, media_type="application/octet-stream", filename="calliotel-v1.0.1-tiktok-signed.aab")

@app.get("/api/dl/cert", include_in_schema=False)
async def download_cert():
    _cert = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "calliotel-upload-cert.pem"))
    if not _os.path.exists(_cert):
        from fastapi import HTTPException as _H
        raise _H(404, "File not found")
    return _FileResponse(_cert, media_type="application/x-pem-file", filename="calliotel-upload-cert.pem")

from routes import esim_routes
app.include_router(esim_routes.router)

from routes import esim_webhook
app.include_router(esim_webhook.router)

# ── Calliotel Developer API ──────────────────────────────────────────────────
from routes import api_keys
app.include_router(api_keys.router, prefix="/api/developer", tags=["Developer — Key Management"])
app.include_router(api_keys.v1, tags=["Developer — Public REST API v1"])


# Add Error Filter Middleware FIRST (before CORS) to mask provider names
from middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorFilterMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    # Production-ready CORS: Parse origins from .env, support wildcards
    allow_origins=[origin.strip() for origin in os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,https://calliotel.com,https://www.calliotel.com').split(',')],
    # Production: explicit origins only (no wildcard Replit regex — CSRF surface)
    allow_origin_regex=None,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Serve calliotel.com frontend static files
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse as FastAPIFileResponse

FRONTEND_BUILD_DIR = Path(__file__).parent.parent / "frontend" / "build"

def _serve_file(path: Path, media_type: str | None = None):
    if path.exists():
        return FastAPIFileResponse(str(path), media_type=media_type)
    from fastapi.responses import Response as R
    return R(status_code=404)

@app.get("/")
async def serve_root(request: Request):
    com_index = FRONTEND_BUILD_DIR / "index.html"
    if com_index.exists():
        return FastAPIFileResponse(
            str(com_index),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )
    from fastapi.responses import Response as R
    return R(status_code=503, content="calliotel.com frontend not built — run 'npm run build' in frontend/")

# ── Cache / Expires header middleware ────────────────────────────────────────
# Adds both Cache-Control AND Expires headers for every response category.
# Rules follow the Yahoo/Google "Best Practices for Speeding Up Your Web Site":
#   • Hashed assets (/static/) → 1 year immutable  (filename changes on every build)
#   • Binary media / audio     → 1 year            (content-addressed uploads)
#   • Icons / favicons / logos → 7 days
#   • manifest / robots / xml  → 1 hour
#   • HTML / API               → no-cache          (must always be fresh)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from email.utils import formatdate
import time as _time

_ONE_YEAR   = 365 * 24 * 3600          # 31 536 000 s
_ONE_WEEK   = 7   * 24 * 3600          # 604 800 s
_ONE_DAY    = 24  * 3600               # 86 400 s
_ONE_HOUR   = 3600                     # 3 600 s

def _expires(seconds: int) -> str:
    """Return an RFC-7231 HTTP-date string offset by *seconds* from now."""
    return formatdate(usegmt=True, localtime=False, timeval=_time.time() + seconds)

# Paths that start with any of these get long-lived caches
_IMMUTABLE_PREFIXES = ("/static/",)                                # content-hashed by CRA
_LONG_PREFIXES      = ("/media/", "/audio/", "/reseller-howto/")   # user uploads / video artifact
_SHORT_PREFIXES     = ("/manifest", "/robots", "/sitemap", "/.well-known/")
_ICON_SUFFIXES      = (".ico", ".png", ".svg", ".webp", ".woff", ".woff2", ".ttf", ".otf")
_ICON_EXACT         = {"/favicon.ico", "/favicon.svg", "/icon-192.png", "/icon-512.png",
                       "/logo192.png", "/logo512.png", "/apple-touch-icon.png"}

class StaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        path = request.url.path

        # ── 1 year, immutable — hashed CRA bundles (JS / CSS / fonts inside /static/) ──
        if any(path.startswith(p) for p in _IMMUTABLE_PREFIXES):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            response.headers["Expires"]        = _expires(_ONE_YEAR)
            response.headers["Vary"]           = "Accept-Encoding"

        # ── 1 year — media / audio uploads, video artifact assets ────────────
        elif any(path.startswith(p) for p in _LONG_PREFIXES):
            response.headers["Cache-Control"] = "public, max-age=31536000"
            response.headers["Expires"]        = _expires(_ONE_YEAR)
            response.headers["Vary"]           = "Accept-Encoding"

        # ── 7 days — icons, favicons, PWA images ─────────────────────────────
        elif path in _ICON_EXACT or (path.startswith("/") and path.endswith(_ICON_SUFFIXES) and "/api/" not in path):
            response.headers["Cache-Control"] = "public, max-age=604800"
            response.headers["Expires"]        = _expires(_ONE_WEEK)

        # ── 1 hour — manifest, robots, sitemap, well-known ───────────────────
        elif any(path.startswith(p) for p in _SHORT_PREFIXES):
            response.headers["Cache-Control"] = "public, max-age=3600"
            response.headers["Expires"]        = _expires(_ONE_HOUR)

        return response

app.add_middleware(StaticCacheMiddleware)

# Mount CRA static assets
_com_static_dir = FRONTEND_BUILD_DIR / "static"
if _com_static_dir.exists():
    logger.info(f"✅ Serving calliotel.com frontend from: {FRONTEND_BUILD_DIR}")
    app.mount("/static", StaticFiles(directory=str(_com_static_dir)), name="com-static")
    _FRONTEND_STATIC_MOUNTED = True
else:
    _FRONTEND_STATIC_MOUNTED = False
    logger.critical(
        f"🚨 CRITICAL: Frontend static dir NOT FOUND at {_com_static_dir}. "
        "The site will serve index.html for ALL /static/* requests — "
        "users will see a blank loading screen. "
        "Run 'cd frontend && yarn build' then restart the API."
    )

@app.get("/manifest.json")
async def manifest():
    return _serve_file(FRONTEND_BUILD_DIR / "manifest.json", "application/json")

@app.get("/sw.js")
async def service_worker_js():
    return _serve_file(FRONTEND_BUILD_DIR / "sw.js", "application/javascript")

@app.get("/service-worker.js")
async def service_worker_compat():
    from fastapi.responses import Response
    noop_sw = "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(n=>Promise.all(n.map(k=>caches.delete(k)))).then(()=>self.clients.claim()));self.registration.unregister()});"
    return Response(content=noop_sw, media_type="application/javascript", headers={"Cache-Control": "no-cache, no-store"})

@app.get("/offline.html")
async def offline_page():
    return _serve_file(FRONTEND_BUILD_DIR / "offline.html", "text/html")

@app.get("/favicon.svg")
async def favicon_svg():
    return _serve_file(FRONTEND_BUILD_DIR / "favicon.svg", "image/svg+xml")

@app.get("/icon-192.png")
async def icon_192():
    return _serve_file(FRONTEND_BUILD_DIR / "icon-192.png", "image/png")

@app.get("/icon-512.png")
async def icon_512():
    return _serve_file(FRONTEND_BUILD_DIR / "icon-512.png", "image/png")

@app.get("/logo192.png")
async def logo_192():
    return _serve_file(FRONTEND_BUILD_DIR / "logo192.png", "image/png")

@app.get("/logo512.png")
async def logo_512():
    return _serve_file(FRONTEND_BUILD_DIR / "logo512.png", "image/png")

@app.get("/apple-touch-icon.png")
async def apple_touch_icon():
    return _serve_file(FRONTEND_BUILD_DIR / "apple-touch-icon.png", "image/png")

@app.get("/favicon.ico")
async def favicon_ico():
    return _serve_file(FRONTEND_BUILD_DIR / "favicon.ico", "image/x-icon")

@app.get("/robots.txt")
async def robots():
    return _serve_file(FRONTEND_BUILD_DIR / "robots.txt", "text/plain")

@app.get("/llms.txt")
async def llms_txt():
    public_llms = Path(__file__).parent.parent / "frontend" / "public" / "llms.txt"
    if public_llms.exists():
        return FastAPIFileResponse(str(public_llms), media_type="text/plain")
    return _serve_file(FRONTEND_BUILD_DIR / "llms.txt", "text/plain")

@app.get("/sitemap.xml")
async def sitemap():
    # Prefer the freshly-edited public version over an older build artifact
    public_sitemap = Path(__file__).parent.parent / "frontend" / "public" / "sitemap.xml"
    if public_sitemap.exists():
        return FastAPIFileResponse(str(public_sitemap), media_type="application/xml")
    return _serve_file(FRONTEND_BUILD_DIR / "sitemap.xml", "application/xml")

# Mount built video artifacts so they ship with the main deployment.
# Each entry: (URL prefix, dist directory). html=True makes /<prefix>/ serve index.html.
_VIDEO_ARTIFACTS = [
    ("/reseller-howto", Path(__file__).parent.parent / "artifacts" / "calliotel-reseller-howto" / "dist" / "public"),
]
for _prefix, _dist in _VIDEO_ARTIFACTS:
    if _dist.exists():
        app.mount(_prefix, StaticFiles(directory=str(_dist), html=True), name=_prefix.strip("/"))
        logger.info(f"✅ Serving video artifact at {_prefix}/ from: {_dist}")
    else:
        logger.warning(f"⚠️  Video artifact not built at {_dist} — {_prefix}/ will 404")

# Digital Asset Links — required for Android App Links / TWA
@app.get("/.well-known/assetlinks.json", include_in_schema=False)
async def assetlinks():
    _f = Path(__file__).parent / "assetlinks.json"
    if _f.exists():
        return Response(content=_f.read_text(), media_type="application/json")
    return Response(content="[]", media_type="application/json")

# Apple App Site Association — required for iOS Universal Links
@app.get("/.well-known/apple-app-site-association", include_in_schema=False)
@app.get("/apple-app-site-association", include_in_schema=False)
async def apple_app_site_association():
    _f = Path(__file__).parent / "apple-app-site-association.json"
    if _f.exists():
        return Response(content=_f.read_text(), media_type="application/json")
    return Response(content="{}", media_type="application/json")

# Catch-all: serve index.html for SPA routing
# Allow HEAD too so Google Ads / Googlebot URL verification doesn't return 405
@app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
async def serve_spa(request: Request, full_path: str):
    from fastapi import HTTPException
    from fastapi.responses import HTMLResponse as _HTMLResponse

    # Domain verification files — must be served before any other checks
    _blocked = (".env", ".git", "wp-admin", "wp-login", "phpinfo", "config.php",
                "xmlrpc.php", ".htaccess", "web.config", "backup", "admin.php")
    if any(full_path == b or full_path.startswith(b) for b in _blocked):
        raise HTTPException(status_code=404)

    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API endpoint not found")

    com_index = FRONTEND_BUILD_DIR / "index.html"
    if com_index.exists():
        return FastAPIFileResponse(
            str(com_index),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )

    raise HTTPException(status_code=404, detail="Frontend not built")