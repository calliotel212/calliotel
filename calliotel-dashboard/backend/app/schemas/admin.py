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
    """Revenue is estimated until per-click wallet debits ship."""

    total_revenue_usd: Decimal
    total_clicks: int
    revenue_formula: str


class AdminAdvertiserRow(BaseModel):
    id: str
    name: str
    wallet_balance: Decimal
    user_count: int
    campaign_count: int


class AdminPublisherRow(BaseModel):
    id: str
    business_name: str | None
    activation_status: str
    agent_status: str
    user_count: int
    phone_number: str | None


class AdminCampaignRow(BaseModel):
    id: str
    advertiser_id: str
    advertiser_name: str
    brand_name: str
    status: str
    max_cpc: Decimal
    daily_budget: Decimal
    clicks: int


class CampaignApprovalResponse(BaseModel):
    id: str
    status: str