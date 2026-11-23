from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ad_event_types import VALID_CLICK
from app.models.ads import AdEvent, Campaign
from app.models.user import Tenant, User
from app.schemas.dashboard import DashboardAdvertisingMetrics, DashboardSummaryResponse
from app.services import tenant_advertiser_service
from app.services.advertiser_shield_service import blocked_fraud_clicks_for_advertiser


def _advertiser_ad_metrics(db: Session, *, advertiser_id: str) -> DashboardAdvertisingMetrics:
    clicks = int(
        db.scalar(
            select(func.count())
            .select_from(AdEvent)
            .join(Campaign, Campaign.id == AdEvent.campaign_id)
            .where(Campaign.advertiser_id == advertiser_id, AdEvent.event_type == VALID_CLICK)
        )
        or 0
    )
    spend_row = db.execute(
        select(func.coalesce(func.sum(Campaign.max_cpc), 0))
        .select_from(AdEvent)
        .join(Campaign, Campaign.id == AdEvent.campaign_id)
        .where(Campaign.advertiser_id == advertiser_id, AdEvent.event_type == VALID_CLICK)
    ).scalar_one()
    spend = Decimal(str(spend_row or 0))
    active = int(
        db.scalar(
            select(func.count())
            .select_from(Campaign)
            .where(Campaign.advertiser_id == advertiser_id, Campaign.status == "active")
        )
        or 0
    )
    blocked = blocked_fraud_clicks_for_advertiser(db, advertiser_id=advertiser_id)
    return DashboardAdvertisingMetrics(
        ad_spend_usd=spend,
        ad_clicks=clicks,
        active_campaigns=active,
        blocked_fraud_clicks=blocked,
    )


def get_dashboard_summary(db: Session, *, tenant_id: str, user: User | None = None) -> DashboardSummaryResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")

    if tenant.activation_status == "active":
        agent_status = "online"
    else:
        agent_status = "offline"
    billing_status = tenant.billing_status
    if billing_status not in ("trial", "active", "past_due"):
        billing_status = "trial"

    advertising: DashboardAdvertisingMetrics | None = None
    if user is not None:
        adv_user = tenant_advertiser_service.get_or_link_advertiser_user(db, user=user)
        advertising = _advertiser_ad_metrics(db, advertiser_id=adv_user.advertiser_id)

    return DashboardSummaryResponse(
        agent_status=agent_status,  # type: ignore[arg-type]
        phone_number=tenant.phone_number,
        calls_this_month=tenant.calls_this_month,
        minutes_used=tenant.minutes_used,
        billing_status=billing_status,  # type: ignore[arg-type]
        advertising=advertising,
    )
