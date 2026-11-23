from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class PublisherRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class PublisherLoginRequest(BaseModel):
    email: EmailStr
    password: str


class PublisherTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    api_key: str | None = Field(
        default=None,
        description="Raw API key; returned once on register or key rotation.",
    )


class PublisherMeResponse(BaseModel):
    id: str
    email: str
    publisher_id: str
    name: str
    pending_balance: Decimal
    paid_balance: Decimal
    total_clicks: int
    total_revenue: Decimal
    revenue_share_percentage: Decimal
    api_key_masked: str
    active_api_keys: int


class PublisherKeyRotateResponse(BaseModel):
    api_key: str
    api_key_masked: str