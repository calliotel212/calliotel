from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.numbers import (
    ActivateAgentResponse,
    AssignNumberRequest,
    AssignNumberResponse,
    PhoneNumbersResponse,
)
from app.services import number_service

router = APIRouter(prefix="/dashboard", tags=["dashboard-numbers"])


@router.get("/numbers", response_model=PhoneNumbersResponse)
def get_numbers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PhoneNumbersResponse:
    try:
        return number_service.list_numbers(db, tenant_id=current_user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/numbers/assign", response_model=AssignNumberResponse)
def post_assign_number(
    body: AssignNumberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssignNumberResponse:
    try:
        return number_service.assign_number(
            db, tenant_id=current_user.tenant_id, number_id=body.number_id
        )
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower():
            code = status.HTTP_409_CONFLICT
        elif "not available" in msg.lower() or "unknown" in msg.lower():
            code = status.HTTP_400_BAD_REQUEST
        elif "already assigned" in msg.lower():
            code = status.HTTP_400_BAD_REQUEST
        else:
            code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=msg) from exc


@router.post("/numbers/activate", response_model=ActivateAgentResponse)
def post_activate_agent(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivateAgentResponse:
    try:
        return number_service.activate_agent(db, tenant_id=current_user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
