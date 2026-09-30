from sqlalchemy.orm import Session

from app.models.user import Tenant
from app.schemas.setup import (
    BusinessSetupResponse,
    BusinessSetupUpdate,
    default_business_hours,
)


def _hours_to_response(raw: dict | None) -> dict | None:
    if raw is None:
        return None
    return raw


def get_business_setup(db: Session, *, tenant_id: str) -> BusinessSetupResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")
    return BusinessSetupResponse(
        business_name=tenant.business_name,
        business_type=tenant.business_type,  # type: ignore[arg-type]
        business_hours=_hours_to_response(tenant.business_hours) or default_business_hours(),
        business_services=tenant.business_services,
        business_faq=tenant.business_faq,
        preferred_language=tenant.preferred_language if tenant.preferred_language in ("en", "ar") else "en",  # type: ignore[arg-type]
        agent_voice=tenant.agent_voice if tenant.agent_voice in ("female", "male") else "female",  # type: ignore[arg-type]
    )


def update_business_setup(
    db: Session, *, tenant_id: str, payload: BusinessSetupUpdate
) -> BusinessSetupResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")

    tenant.business_name = payload.business_name
    tenant.business_type = payload.business_type
    if payload.business_hours is not None:
        tenant.business_hours = {k: v.model_dump() for k, v in payload.business_hours.items()}
    tenant.business_services = payload.business_services
    tenant.business_faq = payload.business_faq
    tenant.preferred_language = payload.preferred_language
    tenant.agent_voice = payload.agent_voice

    if payload.business_name and payload.business_name.strip():
        tenant.name = payload.business_name.strip()

    db.commit()
    db.refresh(tenant)
    return get_business_setup(db, tenant_id=tenant_id)
