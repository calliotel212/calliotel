from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ActivationStatus = Literal["inactive", "pending", "active"]


class PhoneNumberItem(BaseModel):
    id: str
    phone_number: str
    available: bool


class PhoneNumbersResponse(BaseModel):
    numbers: list[PhoneNumberItem]
    activation_status: ActivationStatus
    assigned_number_id: str | None = None
    assigned_phone_number: str | None = None
    activated_at: datetime | None = None


class AssignNumberRequest(BaseModel):
    number_id: str = Field(..., min_length=1)


class AssignNumberResponse(BaseModel):
    activation_status: ActivationStatus
    phone_number_id: str
    phone_number: str


class ActivateAgentResponse(BaseModel):
    activation_status: ActivationStatus
    phone_number: str
    agent_status: Literal["online"]
    activated_at: datetime
