from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class AdminLoginRequest(BaseModel):
    secret: str = Field(min_length=1)
    email: EmailStr | None = None


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class AdminMetricsResponse(BaseModel):
    """Revenue from billed ``valid_click`` events (wallet debits)."""

    total_revenue_usd: Decimal
    total_served: int
    valid_clicks: int
    blocked_fraud_clicks: int
    total_clicks: int = Field(
        description="Deprecated alias for valid_clicks (kept for older admin UI builds)",
    )
    revenue_formula: str


class AdminAdvertiserRow(BaseModel):
    id: str
    user_id: str
    email: str
    name: str
    business_name: str | None = None
    phone_number: str | None = None
    website_url: str | None = None
    kyc_status: str
    wallet_balance: Decimal
    campaign_count: int


class AdminPublisherRow(BaseModel):
    id: str
    name: str
    pending_balance: Decimal
    paid_balance: Decimal
    user_count: int
    impressions: int


class AdminCampaignRow(BaseModel):
    id: str
    advertiser_id: str
    advertiser_name: str
    brand_name: str
    status: str
    max_cpc: Decimal
    daily_budget: Decimal
    clicks: int
    review_ends_at: datetime | None = None
    created_at: datetime | None = None


class CampaignApprovalResponse(BaseModel):
    id: str
    status: str


class AdvertiserKycResponse(BaseModel):
    advertiser_id: str
    kyc_status: str


class CampaignPatchRequest(BaseModel):
    status: str = Field(pattern="^(active|paused|rejected|pending_review)$")