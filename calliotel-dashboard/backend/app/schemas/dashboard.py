from typing import Literal

from pydantic import BaseModel

AgentStatus = Literal["online", "offline"]
BillingStatus = Literal["trial", "active", "past_due"]


class DashboardSummaryResponse(BaseModel):
    agent_status: AgentStatus
    phone_number: str | None
    calls_this_month: int
    minutes_used: int
    billing_status: BillingStatus
