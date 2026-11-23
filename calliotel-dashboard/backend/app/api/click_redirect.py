from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.click_tracking_service import client_ip_from_headers, process_click_redirect

router = APIRouter(tags=["adsfind-click"])


@router.get("/r/{token}")
async def adsfind_click_redirect(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    ip = client_ip_from_headers(
        x_forwarded_for=request.headers.get("x-forwarded-for"),
        client_host=request.client.host if request.client else None,
    )
    ua = request.headers.get("user-agent") or ""

    try:
        result = await process_click_redirect(
            db,
            token=token,
            ip_address=ip,
            user_agent=ua,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return RedirectResponse(url=result.destination_url, status_code=status.HTTP_302_FOUND)