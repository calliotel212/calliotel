from sqlalchemy.orm import Session

from app.models.user import Tenant
from app.schemas.dashboard import DashboardSummaryResponse


def get_dashboard_summary(db: Session, *, tenant_id: str) -> DashboardSummaryResponse:
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

    return DashboardSummaryResponse(
        agent_status=agent_status,  # type: ignore[arg-type]
        phone_number=tenant.phone_number,
        calls_this_month=tenant.calls_this_month,
        minutes_used=tenant.minutes_used,
        billing_status=billing_status,  # type: ignore[arg-type]
    )
