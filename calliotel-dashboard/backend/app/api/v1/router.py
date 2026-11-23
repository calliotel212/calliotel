from fastapi import APIRouter

from app.api.v1 import ads, advertisers, auth, dashboard, numbers, setup

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(advertisers.router)
api_router.include_router(ads.router)
api_router.include_router(dashboard.router)
api_router.include_router(numbers.router)
api_router.include_router(setup.router)
