from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.admin_deps import require_admin
from app.core.config import settings
from app.core.security import create_admin_access_token
from app.db.session import get_db
from app.schemas.admin import (
    AdminAdvertiserRow,
    AdminCampaignRow,
    AdminLoginRequest,
    AdminMetricsResponse,
    AdminPublisherRow,
    AdminTokenResponse,
    CampaignApprovalResponse,
)
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_email_allowed(email: str | None) -> bool:
    raw = settings.admin_emails.strip()
    if not raw:
        return True
    allowed = {e.strip().lower() for e in raw.split(",") if e.strip()}
    if not email:
        return False
    return email.strip().lower() in allowed


@router.post("/login", response_model=AdminTokenResponse)
def admin_login(body: AdminLoginRequest) -> AdminTokenResponse:
    secret = settings.admin_secret.strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin console is not configured",
        )
    if body.secret != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    if not _admin_email_allowed(body.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not authorized for admin access")
    token = create_admin_access_token(email=str(body.email) if body.email else None)
    return AdminTokenResponse(
        access_token=token,
        expires_in_minutes=settings.admin_jwt_expire_minutes,
    )


@router.get("/metrics", response_model=AdminMetricsResponse)
def admin_metrics(
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminMetricsResponse:
    revenue, clicks, formula = admin_service.get_metrics(db)
    return AdminMetricsResponse(
        total_revenue_usd=revenue,
        total_clicks=clicks,
        revenue_formula=formula,
    )


@router.get("/advertisers", response_model=list[AdminAdvertiserRow])
def admin_advertisers(
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminAdvertiserRow]:
    return [AdminAdvertiserRow.model_validate(row) for row in admin_service.list_advertisers(db)]


@router.get("/publishers", response_model=list[AdminPublisherRow])
def admin_publishers(
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminPublisherRow]:
    return [AdminPublisherRow.model_validate(row) for row in admin_service.list_publishers(db)]


@router.get("/campaigns", response_model=list[AdminCampaignRow])
def admin_campaigns(
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminCampaignRow]:
    return [AdminCampaignRow.model_validate(row) for row in admin_service.list_campaigns_for_review(db)]


@router.post("/campaigns/{campaign_id}/approve", response_model=CampaignApprovalResponse)
def approve_campaign(
    campaign_id: str,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CampaignApprovalResponse:
    campaign = admin_service.approve_campaign(db, campaign_id=campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return CampaignApprovalResponse(id=campaign.id, status=campaign.status)


@router.post("/campaigns/{campaign_id}/reject", response_model=CampaignApprovalResponse)
def reject_campaign(
    campaign_id: str,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CampaignApprovalResponse:
    campaign = admin_service.reject_campaign(db, campaign_id=campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return CampaignApprovalResponse(id=campaign.id, status=campaign.status)