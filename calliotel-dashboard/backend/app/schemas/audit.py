from typing import Literal

from pydantic import BaseModel, Field, model_validator


class WebsiteAuditRequest(BaseModel):
    website_url: str = Field(min_length=4, max_length=2048)


class TrafficEstimate(BaseModel):
    """Estimated organic/traffic potential for the audited site."""

    level: Literal["Low", "Medium", "High"]
    reason: str = Field(min_length=1, max_length=2000)


class SeoHealth(BaseModel):
    score: int = Field(ge=1, le=100)
    issues: list[str]
    quick_wins: list[str]


class WebsiteAuditResponse(BaseModel):
    website_url: str
    overall_score: int = Field(ge=1, le=100)
    traffic_estimate: TrafficEstimate
    seo_health: SeoHealth
    competitor_insights: list[str]
    ai_ad_recommendations: list[str]
    missing_keywords: list[str]
    ssl_status: str
    response_time_ms: int | None = None
    title: str | None = None
    # Legacy fields (same values as premium keys for older clients)
    site_score: int = Field(ge=1, le=100)
    ad_recommendations: list[str]
    competitor_insight: str | None = Field(
        default=None,
        description="Deprecated single-string competitor summary; joined from competitor_insights.",
    )

    @model_validator(mode="after")
    def _sync_legacy_fields(self) -> "WebsiteAuditResponse":
        if self.site_score != self.overall_score:
            object.__setattr__(self, "site_score", self.overall_score)
        if self.ad_recommendations != self.ai_ad_recommendations:
            object.__setattr__(self, "ad_recommendations", list(self.ai_ad_recommendations))
        if not self.competitor_insight and self.competitor_insights:
            object.__setattr__(self, "competitor_insight", " ".join(self.competitor_insights))
        return self