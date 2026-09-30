from typing import Literal

from pydantic import BaseModel, Field

BusinessType = Literal["restaurant", "salon", "clinic", "real_estate", "other"]
PreferredLanguage = Literal["en", "ar"]
AgentVoice = Literal["female", "male"]

DAY_KEYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


class DayHours(BaseModel):
    open: str = "09:00"
    close: str = "17:00"
    closed: bool = False


class BusinessSetupResponse(BaseModel):
    business_name: str | None
    business_type: BusinessType | None
    business_hours: dict[str, DayHours] | None
    business_services: str | None
    business_faq: str | None
    preferred_language: PreferredLanguage
    agent_voice: AgentVoice


class BusinessSetupUpdate(BaseModel):
    business_name: str | None = Field(default=None, max_length=255)
    business_type: BusinessType | None = None
    business_hours: dict[str, DayHours] | None = None
    business_services: str | None = None
    business_faq: str | None = None
    preferred_language: PreferredLanguage = "en"
    agent_voice: AgentVoice = "female"


def default_business_hours() -> dict[str, dict]:
    return {day: {"open": "09:00", "close": "17:00", "closed": False} for day in DAY_KEYS}
