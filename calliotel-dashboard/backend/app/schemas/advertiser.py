from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class AdvertiserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str | None = Field(default=None, max_length=255)


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
    status: str = Field(default="active", pattern="^(active|paused)$")


class CampaignUpdateRequest(BaseModel):
    brand_name: str | None = Field(default=None, min_length=1, max_length=255)
    ad_copy: str | None = Field(default=None, min_length=1)
    destination_url: str | None = Field(default=None, min_length=1, max_length=2048)
    intent_description: str | None = Field(default=None, min_length=1)
    max_cpc: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=4)
    status: str | None = Field(default=None, pattern="^(active|paused)$")


class CampaignResponse(BaseModel):
    id: str
    advertiser_id: str
    brand_name: str
    ad_copy: str
    destination_url: str
    intent_description: str
    max_cpc: Decimal
    status: str

    model_config = {"from_attributes": True}