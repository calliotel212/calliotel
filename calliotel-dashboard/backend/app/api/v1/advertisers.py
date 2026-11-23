from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_advertiser_user
from app.db.session import get_db
from app.models.ads import AdvertiserUser
from app.schemas.advertiser import (
    AdvertiserLoginRequest,
    AdvertiserMeResponse,
    AdvertiserRegisterRequest,
    AdvertiserTokenResponse,
    CampaignCreateRequest,
    CampaignResponse,
    CampaignUpdateRequest,
    WalletDepositRequest,
    WalletDepositResponse,
    WalletResponse,
)
from app.services import advertiser_auth_service, advertiser_campaign_service, advertiser_wallet_service

router = APIRouter(prefix="/advertisers", tags=["advertisers"])


@router.post("/register", response_model=AdvertiserTokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: AdvertiserRegisterRequest, db: Session = Depends(get_db)) -> AdvertiserTokenResponse:
    try:
        user = advertiser_auth_service.register_advertiser(
            db,
            email=body.email,
            password=body.password,
            business_name=body.business_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = advertiser_auth_service.issue_token_for_advertiser_user(user)
    return AdvertiserTokenResponse(access_token=token)


@router.post("/login", response_model=AdvertiserTokenResponse)
def login(body: AdvertiserLoginRequest, db: Session = Depends(get_db)) -> AdvertiserTokenResponse:
    user = advertiser_auth_service.authenticate_advertiser(db, email=body.email, password=body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return AdvertiserTokenResponse(
        access_token=advertiser_auth_service.issue_token_for_advertiser_user(user)
    )


@router.get("/me", response_model=AdvertiserMeResponse)
def me(current: AdvertiserUser = Depends(get_current_advertiser_user)) -> AdvertiserMeResponse:
    adv = current.advertiser
    return AdvertiserMeResponse(
        id=current.id,
        email=current.email,
        advertiser_id=current.advertiser_id,
        business_name=adv.name,
        wallet_balance=adv.wallet_balance,
    )


@router.get("/wallet", response_model=WalletResponse)
def wallet(
    current: AdvertiserUser = Depends(get_current_advertiser_user),
    db: Session = Depends(get_db),
) -> WalletResponse:
    balance = advertiser_wallet_service.get_wallet_balance(db, advertiser_id=current.advertiser_id)
    return WalletResponse(balance_usd=balance)


@router.post("/wallet/deposit", response_model=WalletDepositResponse)
def wallet_deposit(
    body: WalletDepositRequest,
    current: AdvertiserUser = Depends(get_current_advertiser_user),
    db: Session = Depends(get_db),
) -> WalletDepositResponse:
    try:
        balance, deposited = advertiser_wallet_service.deposit_funds(
            db, advertiser_id=current.advertiser_id, amount_usd=body.amount_usd
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return WalletDepositResponse(balance_usd=balance, deposited_usd=deposited)


@router.get("/campaigns", response_model=list[CampaignResponse])
def list_campaigns(
    current: AdvertiserUser = Depends(get_current_advertiser_user),
    db: Session = Depends(get_db),
) -> list[CampaignResponse]:
    items = advertiser_campaign_service.list_campaigns(db, advertiser_id=current.advertiser_id)
    return [CampaignResponse.model_validate(c) for c in items]


@router.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(
    body: CampaignCreateRequest,
    current: AdvertiserUser = Depends(get_current_advertiser_user),
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
        status=body.status,
    )
    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: str,
    current: AdvertiserUser = Depends(get_current_advertiser_user),
    db: Session = Depends(get_db),
) -> CampaignResponse:
    campaign = advertiser_campaign_service.get_campaign(
        db, advertiser_id=current.advertiser_id, campaign_id=campaign_id
    )
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse)
def patch_campaign(
    campaign_id: str,
    body: CampaignUpdateRequest,
    current: AdvertiserUser = Depends(get_current_advertiser_user),
    db: Session = Depends(get_db),
) -> CampaignResponse:
    campaign = advertiser_campaign_service.get_campaign(
        db, advertiser_id=current.advertiser_id, campaign_id=campaign_id
    )
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    updated = advertiser_campaign_service.update_campaign(
        db,
        campaign=campaign,
        brand_name=body.brand_name,
        ad_copy=body.ad_copy,
        destination_url=str(body.destination_url) if body.destination_url is not None else None,
        intent_description=body.intent_description,
        max_cpc=body.max_cpc,
        status=body.status,
    )
    return CampaignResponse.model_validate(updated)