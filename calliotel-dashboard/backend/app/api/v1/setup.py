from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.setup import BusinessSetupResponse, BusinessSetupUpdate
from app.services import setup_service

router = APIRouter(tags=["dashboard-setup"])


@router.get("/dashboard/setup", response_model=BusinessSetupResponse)
def get_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessSetupResponse:
    try:
        return setup_service.get_business_setup(db, tenant_id=current_user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/dashboard/setup", response_model=BusinessSetupResponse)
def put_setup(
    body: BusinessSetupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessSetupResponse:
    try:
        return setup_service.update_business_setup(
            db, tenant_id=current_user.tenant_id, payload=body
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
