from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_publisher_user
from app.db.session import get_db
from app.models.ads import PublisherUser
from app.schemas.publisher import (
    PublisherKeyRotateResponse,
    PublisherLoginRequest,
    PublisherMeResponse,
    PublisherRegisterRequest,
    PublisherTokenResponse,
)
from app.services import publisher_service

router = APIRouter(prefix="/publishers", tags=["publishers"])


@router.post("/register", response_model=PublisherTokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: PublisherRegisterRequest, db: Session = Depends(get_db)) -> PublisherTokenResponse:
    try:
        user, raw_key = publisher_service.register_publisher(
            db,
            email=body.email,
            password=body.password,
            name=body.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = publisher_service.issue_token_for_publisher_user(user)
    return PublisherTokenResponse(access_token=token, api_key=raw_key)


@router.post("/login", response_model=PublisherTokenResponse)
def login(body: PublisherLoginRequest, db: Session = Depends(get_db)) -> PublisherTokenResponse:
    user = publisher_service.authenticate_publisher(db, email=body.email, password=body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return PublisherTokenResponse(
        access_token=publisher_service.issue_token_for_publisher_user(user),
    )


@router.get("/me", response_model=PublisherMeResponse)
def me(
    current: PublisherUser = Depends(get_current_publisher_user),
    db: Session = Depends(get_db),
) -> PublisherMeResponse:
    pub = current.publisher
    stats = publisher_service.publisher_stats(
        db,
        publisher=pub,
        publisher_user_id=current.id,
        email=current.email,
    )
    return PublisherMeResponse(**stats)


@router.post("/keys/rotate", response_model=PublisherKeyRotateResponse)
def rotate_key(
    current: PublisherUser = Depends(get_current_publisher_user),
    db: Session = Depends(get_db),
) -> PublisherKeyRotateResponse:
    try:
        raw_key, publisher = publisher_service.rotate_publisher_api_key(
            db, publisher_id=current.publisher_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PublisherKeyRotateResponse(
        api_key=raw_key,
        api_key_masked=publisher_service.mask_api_key(publisher.api_key_last4),
    )