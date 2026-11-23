from pydantic import BaseModel, Field


class AdMatchResponse(BaseModel):
    brand_name: str
    ad_copy: str
    campaign_id: str
    destination_url: str
    match_score: int = Field(ge=0)


class AdMatchQuery(BaseModel):
    q: str = Field(min_length=1, max_length=2000)