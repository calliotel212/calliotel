from pydantic import BaseModel, Field


class WebsiteAuditRequest(BaseModel):
    website_url: str = Field(min_length=4, max_length=2048)


class WebsiteAuditResponse(BaseModel):
    website_url: str
    site_score: int = Field(ge=1, le=100)
    ssl_status: str
    missing_keywords: list[str]
    competitor_insights: str
    ad_recommendations: list[str]
    response_time_ms: int | None = None
    title: str | None = None