"""JWT user lookup without importing the full auth router."""
import os
import logging

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import db

logger = logging.getLogger(__name__)
security = HTTPBearer()
ALGORITHM = "HS256"


def _secret() -> str:
    key = (os.environ.get("JWT_SECRET_KEY") or "").strip()
    if not key or len(key) < 32:
        raise HTTPException(status_code=503, detail="Local auth is not configured")
    return key


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, _secret(), algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        user = await db.users.find_one({"_id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("banned"):
            raise HTTPException(status_code=403, detail="This account has been suspended.")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error("DB error in get_current_user: %s", e)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
