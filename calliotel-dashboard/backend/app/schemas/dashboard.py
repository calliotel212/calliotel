from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

AgentStatus = Literal["online", "offline"]
BillingStatus = Literal["trial", "active", "past_due"]


class DashboardAdvertisingMetrics(BaseModel):
    ad_spend_usd: Decimal = Field(description="Spend from valid click events × max CPC")
    ad_clicks: int
    active_campaigns: int
    blocked_fraud_clicks: int = 0


class DashboardSummaryResponse(BaseModel):
    agent_status: AgentStatus
    phone_number: str | None
    calls_this_month: int
    minutes_used: int
    billing_status: BillingStatus
    advertising: DashboardAdvertisingMetrics | None = None
