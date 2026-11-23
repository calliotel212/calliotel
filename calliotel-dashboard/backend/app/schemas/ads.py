from pydantic import BaseModel, Field


class AdMatchResponse(BaseModel):
    brand_name: str
    ad_copy: str
    campaign_id: str
    destination_url: str
    click_url: str = Field(description="Signed redirect URL; charges advertiser wallet on first valid click per IP/UA/day")
    match_score: int = Field(ge=1, le=10, description="Relevance 1–10 (LLM semantic or keyword fallback)")


class AdMatchQuery(BaseModel):
    q: str = Field(min_length=1, max_length=2000)