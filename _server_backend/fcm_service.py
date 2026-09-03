"""
FCM (Firebase Cloud Messaging) — sends native push notifications to Android/iOS.
This wakes the app even when it's fully killed.

Setup required (one-time):
  1. Go to console.firebase.google.com → Project Settings → Service Accounts
  2. Click "Generate new private key" → download JSON
  3. Place JSON at /var/www/calliotel/firebase-service-account.json
  4. Place google-services.json in artifacts/calliotel-app/ for the EAS build

Without this setup, the function logs a warning and falls back to Web Push.
"""
import os
import json
import logging
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
_access_token_cache: dict = {"token": None, "expires_at": 0}


def _get_service_account() -> dict | None:
    # Prefer fixed JSON file (env value may be a corrupted JS-object literal)
    for path in (
        "/var/www/calliotel/firebase-service-account.json",
        os.path.join(os.path.dirname(__file__), "..", "firebase-service-account.json"),
    ):
        try:
            if os.path.isfile(path):
                with open(path, "r") as fh:
                    return json.load(fh)
        except Exception as e:
            logger.error(f"FCM: failed reading {path}: {e}")
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception as e:
        logger.error(f"FCM: invalid FIREBASE_SERVICE_ACCOUNT_JSON — {e}")
        return None


async def _get_access_token(sa: dict) -> str | None:
    """Get OAuth2 access token from Google using the service account."""
    import time
    now = time.time()
    if _access_token_cache["token"] and now < _access_token_cache["expires_at"] - 60:
        return _access_token_cache["token"]

    try:
        import jwt as pyjwt  # PyJWT
        claim = {
            "iss": sa["client_email"],
            "scope": "https://www.googleapis.com/auth/firebase.messaging",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": int(now),
            "exp": int(now) + 3600,
        }
        signed = pyjwt.encode(claim, sa["private_key"], algorithm="RS256")
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": signed,
                },
            )
        data = resp.json()
        token = data.get("access_token")
        if token:
            _access_token_cache["token"] = token
            _access_token_cache["expires_at"] = now + data.get("expires_in", 3600)
        return token
    except ImportError:
        logger.error("FCM: PyJWT not installed — run: pip install PyJWT cryptography")
        return None
    except Exception as e:
        logger.error(f"FCM: failed to get access token — {e}")
        return None


async def send_fcm_push(
    device_token: str,
    title: str,
    body: str,
    data: dict | None = None,
    badge: int | None = None,
) -> bool:
    """
    Send a high-priority FCM push to a single device token.
    Returns True on success, False on failure.
    """
    sa = _get_service_account()
    if not sa:
        logger.debug("FCM: not configured — skipping FCM push")
        return False

    # Expo push tokens use Expo's API, not FCM HTTP v1
    if isinstance(device_token, str) and device_token.startswith("ExponentPushToken"):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": device_token,
                        "title": title,
                        "body": body,
                        "sound": "default",
                        "priority": "high",
                        "channelId": "calliotel_alerts",
                        "data": data or {},
                        "badge": badge,
                    },
                )
            ok = resp.status_code < 300
            if not ok:
                logger.error(f"Expo push failed: {resp.status_code} {resp.text[:200]}")
            return ok
        except Exception as e:
            logger.error(f"Expo push error: {e}")
            return False

    token = await _get_access_token(sa)
    if not token:
        return False

    project_id = sa.get("project_id", "")
    url = _FCM_ENDPOINT.format(project_id=project_id)

    message: dict = {
        "token": device_token,
        "notification": {"title": title, "body": body},
        "android": {
            "priority": "high",
            "notification": {
                "channel_id": "calliotel_alerts",
                "priority": "max",
                "default_vibrate_timings": True,
                "notification_count": badge,
            },
        },
        "apns": {
            "headers": {"apns-priority": "10"},
            "payload": {
                "aps": {
                    "alert": {"title": title, "body": body},
                    "badge": badge,
                    "sound": "default",
                    "content-available": 1,
                }
            },
        },
        "data": {str(k): str(v) for k, v in (data or {}).items()},
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"message": message},
            )
        if resp.status_code >= 300:
            logger.error(f"FCM push failed: {resp.status_code} {resp.text[:300]}")
            return False
        return True
    except Exception as e:
        logger.error(f"FCM push error: {e}")
        return False


async def send_fcm_to_user(
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
    badge: int | None = None,
    db=None,
) -> int:
    """
    Send FCM push to ALL registered devices for a user.
    Returns count of successful pushes.
    """
    if db is None:
        return 0
    sa = _get_service_account()
    # Still allow Expo tokens even if SA missing? Expo doesn't need SA.
    tokens = await db.device_tokens.find(
        {"user_id": user_id, "active": True},
        {"token": 1},
    ).to_list(length=20)

    if not tokens:
        return 0
    if not sa and not any(str(t.get("token", "")).startswith("ExponentPushToken") for t in tokens):
        return 0

    sent = 0
    for t in tokens:
        ok = await send_fcm_push(t["token"], title, body, data, badge)
        if ok:
            sent += 1
        else:
            # Deactivate invalid token
            await db.device_tokens.update_one(
                {"_id": t["_id"]},
                {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc).isoformat()}},
            )
    return sent
