from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class AdvertiserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=6, max_length=32)
    website_url: str = Field(min_length=4, max_length=2048)


class AdvertiserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdvertiserTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdvertiserMeResponse(BaseModel):
    id: str
    email: str
    advertiser_id: str
    business_name: str
    phone_number: str | None = None
    website_url: str | None = None
    kyc_status: str
    wallet_balance: Decimal


class WalletResponse(BaseModel):
    balance_usd: Decimal


class WalletDepositRequest(BaseModel):
    amount_usd: Decimal = Field(gt=0, max_digits=12, decimal_places=4)


class WalletDepositResponse(BaseModel):
    balance_usd: Decimal
    deposited_usd: Decimal


class CampaignCreateRequest(BaseModel):
    brand_name: str = Field(min_length=1, max_length=255)
    ad_copy: str = Field(min_length=1)
    destination_url: str = Field(min_length=1, max_length=2048)
    intent_description: str = Field(min_length=1)
    max_cpc: Decimal = Field(gt=0, max_digits=12, decimal_places=4)
    daily_budget: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=4)
    target_countries: list[str] = Field(default_factory=list)
    target_languages: list[str] = Field(default_factory=list)


class CampaignUpdateRequest(BaseModel):
    brand_name: str | None = Field(default=None, min_length=1, max_length=255)
    ad_copy: str | None = Field(default=None, min_length=1)
    destination_url: str | None = Field(default=None, min_length=1, max_length=2048)
    intent_description: str | None = Field(default=None, min_length=1)
    max_cpc: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=4)
    daily_budget: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=4)
    target_countries: list[str] | None = None
    target_languages: list[str] | None = None
    status: str | None = Field(default=None, pattern="^(active|paused)$")


class CampaignResponse(BaseModel):
    id: str
    advertiser_id: str
    brand_name: str
    ad_copy: str
    destination_url: str
    intent_description: str
    max_cpc: Decimal
    daily_budget: Decimal
    target_countries: list[str]
    target_languages: list[str]
    status: str
    clicks: int = 0  # served-event count until dedicated click tracking exists
    review_ends_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}