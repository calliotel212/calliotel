from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.ads import AdMatchResponse
from app.services.ad_matcher import find_sponsored_ad

router = APIRouter(prefix="/internal/ads", tags=["ads-internal"])


def verify_internal_ads_key(
    x_internal_ads_api_key: str | None = Header(default=None, alias="X-Internal-Ads-Api-Key"),
) -> None:
    expected = settings.internal_ads_api_key.strip()
    if not expected:
        return
    if not x_internal_ads_api_key or x_internal_ads_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal ads API key",
        )


@router.get("/match", response_model=AdMatchResponse)
def match_ad(
    q: str = Query(..., min_length=1, max_length=2000),
    country: str | None = Query(
        default=None,
        max_length=8,
        description="ISO country code; only campaigns targeting this country (or unrestricted) match.",
    ),
    language: str | None = Query(
        default=None,
        max_length=8,
        description="Language code (e.g. en, ar); only campaigns targeting this language (or unrestricted) match.",
    ),
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_ads_key),
) -> AdMatchResponse:
    result = find_sponsored_ad(db, q, country=country, language=language)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No sponsored ad match")
    return AdMatchResponse(**result)