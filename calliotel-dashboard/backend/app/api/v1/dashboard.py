from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.advertisers import _campaign_response
from app.core.deps import get_current_user, get_tenant_linked_advertiser_user
from app.db.session import get_db
from app.models.ads import AdvertiserUser
from app.models.user import User
from app.schemas.advertiser import (
    CampaignCreateRequest,
    CampaignResponse,
    CampaignUpdateRequest,
    AdvertiserShieldStatsResponse,
    WalletDepositRequest,
    WalletDepositResponse,
    WalletResponse,
)
from app.schemas.dashboard import DashboardSummaryResponse
from app.services import advertiser_campaign_service, advertiser_wallet_service, dashboard_service
from app.services.advertiser_shield_service import blocked_fraud_clicks_for_advertiser

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    try:
        return dashboard_service.get_dashboard_summary(
            db, tenant_id=current_user.tenant_id, user=current_user
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/advertising/shield/stats", response_model=AdvertiserShieldStatsResponse)
def advertising_shield_stats(
    current: AdvertiserUser = Depends(get_tenant_linked_advertiser_user),
    db: Session = Depends(get_db),
) -> AdvertiserShieldStatsResponse:
    blocked = blocked_fraud_clicks_for_advertiser(db, advertiser_id=current.advertiser_id)
    return AdvertiserShieldStatsResponse(blocked_fraud_clicks=blocked)


@router.get("/advertising/wallet", response_model=WalletResponse)
def advertising_wallet(
    current: AdvertiserUser = Depends(get_tenant_linked_advertiser_user),
    db: Session = Depends(get_db),
) -> WalletResponse:
    balance = advertiser_wallet_service.get_wallet_balance(db, advertiser_id=current.advertiser_id)
    return WalletResponse(balance_usd=balance)


@router.post("/advertising/wallet/deposit", response_model=WalletDepositResponse)
def advertising_wallet_deposit(
    body: WalletDepositRequest,
    current: AdvertiserUser = Depends(get_tenant_linked_advertiser_user),
    db: Session = Depends(get_db),
) -> WalletDepositResponse:
    try:
        balance, deposited = advertiser_wallet_service.deposit_funds(
            db, advertiser_id=current.advertiser_id, amount_usd=body.amount_usd
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return WalletDepositResponse(balance_usd=balance, deposited_usd=deposited)


@router.get("/advertising/campaigns", response_model=list[CampaignResponse])
def advertising_list_campaigns(
    current: AdvertiserUser = Depends(get_tenant_linked_advertiser_user),
    db: Session = Depends(get_db),
) -> list[CampaignResponse]:
    items = advertiser_campaign_service.list_campaigns(db, advertiser_id=current.advertiser_id)
    ids = [c.id for c in items]
    counts = advertiser_campaign_service.campaign_served_counts(db, campaign_ids=ids)
    out: list[CampaignResponse] = []
    for c in items:
        base = CampaignResponse.model_validate(c)
        out.append(base.model_copy(update={"clicks": counts.get(c.id, 0)}))
    return out


@router.post("/advertising/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def advertising_create_campaign(
    body: CampaignCreateRequest,
    current: AdvertiserUser = Depends(get_tenant_linked_advertiser_user),
    db: Session = Depends(get_db),
) -> CampaignResponse:
    campaign = advertiser_campaign_service.create_campaign(
        db,
        advertiser_id=current.advertiser_id,
        brand_name=body.brand_name,
        ad_copy=body.ad_copy,
        destination_url=str(body.destination_url),
        intent_description=body.intent_description,
        max_cpc=body.max_cpc,
        daily_budget=body.daily_budget,
        target_countries=body.target_countries,
        target_languages=body.target_languages,
    )
    return _campaign_response(db, campaign)


@router.patch("/advertising/campaigns/{campaign_id}", response_model=CampaignResponse)
def advertising_patch_campaign(
    campaign_id: str,
    body: CampaignUpdateRequest,
    current: AdvertiserUser = Depends(get_tenant_linked_advertiser_user),
    db: Session = Depends(get_db),
) -> CampaignResponse:
    campaign = advertiser_campaign_service.get_campaign(
        db, advertiser_id=current.advertiser_id, campaign_id=campaign_id
    )
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if body.status is not None and campaign.status in ("pending_review", "pending_approval", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign must be approved before changing live status",
        )
    updated = advertiser_campaign_service.update_campaign(
        db,
        campaign=campaign,
        brand_name=body.brand_name,
        ad_copy=body.ad_copy,
        destination_url=str(body.destination_url) if body.destination_url is not None else None,
        intent_description=body.intent_description,
        max_cpc=body.max_cpc,
        daily_budget=body.daily_budget,
        target_countries=body.target_countries,
        target_languages=body.target_languages,
        status=body.status,
    )
    return _campaign_response(db, updated)