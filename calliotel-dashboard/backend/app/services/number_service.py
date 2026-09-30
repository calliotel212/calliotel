from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Tenant
from app.schemas.numbers import (
    ActivateAgentResponse,
    AssignNumberResponse,
    PhoneNumberItem,
    PhoneNumbersResponse,
)

MOCK_NUMBERS: list[tuple[str, str]] = [
    (f"us-555-0{100 + i}", f"+1 555 0{100 + i}") for i in range(10)
]


def _mock_by_id(number_id: str) -> tuple[str, str] | None:
    for nid, display in MOCK_NUMBERS:
        if nid == number_id:
            return nid, display
    return None


def _assigned_tenant_ids(db: Session) -> dict[str, str]:
    rows = db.execute(
        select(Tenant.id, Tenant.phone_number_id).where(Tenant.phone_number_id.is_not(None))
    ).all()
    return {phone_number_id: tenant_id for tenant_id, phone_number_id in rows if phone_number_id}


def list_numbers(db: Session, *, tenant_id: str) -> PhoneNumbersResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")

    assigned = _assigned_tenant_ids(db)
    items: list[PhoneNumberItem] = []
    for number_id, display in MOCK_NUMBERS:
        holder = assigned.get(number_id)
        available = holder is None or holder == tenant_id
        items.append(PhoneNumberItem(id=number_id, phone_number=display, available=available))

    status = tenant.activation_status
    if status not in ("inactive", "pending", "active"):
        status = "inactive"

    return PhoneNumbersResponse(
        numbers=items,
        activation_status=status,  # type: ignore[arg-type]
        assigned_number_id=tenant.phone_number_id,
        assigned_phone_number=tenant.phone_number,
        activated_at=tenant.activated_at,
    )


def assign_number(db: Session, *, tenant_id: str, number_id: str) -> AssignNumberResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")

    status = tenant.activation_status
    if status == "active":
        raise ValueError("Phone number is locked after activation")

    mock = _mock_by_id(number_id)
    if mock is None:
        raise ValueError("Unknown phone number")

    _, display = mock
    assigned = _assigned_tenant_ids(db)
    holder = assigned.get(number_id)
    if holder is not None and holder != tenant_id:
        raise ValueError("Phone number is not available")

    if status == "pending" and tenant.phone_number_id == number_id:
        raise ValueError("Already assigned to this number")

    tenant.phone_number_id = number_id
    tenant.phone_number = display
    tenant.activation_status = "pending"
    tenant.agent_status = "offline"

    db.commit()
    db.refresh(tenant)

    return AssignNumberResponse(
        activation_status="pending",
        phone_number_id=number_id,
        phone_number=display,
    )


def activate_agent(db: Session, *, tenant_id: str) -> ActivateAgentResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")

    if tenant.activation_status != "pending":
        raise ValueError("Assign a phone number before activating")
    if not tenant.phone_number_id or not tenant.phone_number:
        raise ValueError("Assign a phone number before activating")

    now = datetime.now(timezone.utc)
    tenant.activation_status = "active"
    tenant.activated_at = now
    tenant.agent_status = "online"

    db.commit()
    db.refresh(tenant)

    return ActivateAgentResponse(
        activation_status="active",
        phone_number=tenant.phone_number,
        agent_status="online",
        activated_at=now,
    )
