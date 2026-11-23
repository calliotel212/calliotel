import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.click_redirect import router as click_redirect_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.redis import close_redis, init_redis
from app.db.session import SessionLocal
from app.services.campaign_review_service import process_due_campaign_reviews

_REVIEW_INTERVAL_SECONDS = 15 * 60


async def _campaign_review_loop() -> None:
    while True:
        await asyncio.sleep(_REVIEW_INTERVAL_SECONDS)
        db = SessionLocal()
        try:
            process_due_campaign_reviews(db)
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    task = asyncio.create_task(_campaign_review_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await close_redis()


app = FastAPI(title="Calliotel Dashboard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url.rstrip("/")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(click_redirect_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}