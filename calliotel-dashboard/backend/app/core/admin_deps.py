import secrets

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.security import decode_admin_access_token

admin_bearer = HTTPBearer(auto_error=False)


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(admin_bearer),
    x_admin_api_key: str | None = Header(default=None, alias="X-Admin-Api-Key"),
) -> dict:
    api_key = settings.admin_api_key.strip()
    if api_key and x_admin_api_key and secrets.compare_digest(x_admin_api_key.strip(), api_key):
        return {"auth": "api_key"}

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required")
    try:
        payload = decode_admin_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token") from exc
    return payload