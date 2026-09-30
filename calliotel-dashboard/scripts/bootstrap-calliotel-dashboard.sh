#!/usr/bin/env bash
# Bootstrap calliotel-dashboard — macOS/Linux.
set -euo pipefail
INSTALL_DIR="${1:-calliotel-dashboard}"
mkdir -p "$INSTALL_DIR"
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"
echo "Writing calliotel-dashboard to: $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/.env.example" << 'CALLOIOTEL__env_example'
# --- PostgreSQL (docker-compose service: postgres) ---
POSTGRES_USER=calliotel
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
POSTGRES_DB=calliotel_dashboard
DATABASE_URL=postgresql+psycopg://calliotel:REPLACE_WITH_STRONG_PASSWORD@postgres:5432/calliotel_dashboard

# --- FastAPI ---
API_HOST=0.0.0.0
API_PORT=8000
API_PUBLIC_URL=http://localhost:8000
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_URL=http://localhost:3000

# --- Resend (forgot password) ---
RESEND_API_KEY=REPLACE_WITH_YOUR_RESEND_KEY
EMAIL_FROM=Calliotel <noreply@calliotel.ai>

# --- Next.js (browser) ---
NEXT_PUBLIC_API_URL=http://localhost:8000

# --- Production (droplet + Caddy — fill when deploying) ---
# API_PUBLIC_URL=https://app.calliotel.ai
# FRONTEND_URL=https://app.calliotel.ai
# NEXT_PUBLIC_API_URL=https://app.calliotel.ai
CALLOIOTEL__env_example

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/.gitignore" << 'CALLOIOTEL__gitignore'
.env
node_modules/
.next/
__pycache__/
*.pyc
.venv/
CALLOIOTEL__gitignore

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/README.md" << 'CALLOIOTEL_README_md'
# Calliotel client dashboard

Customer-facing app for **app.calliotel.ai**: auth + business dashboard.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind
- **Backend:** FastAPI, SQLAlchemy, Alembic, JWT
- **Database:** PostgreSQL 16
- **Email:** Resend (password reset)

## Quick start (Docker)

```bash
cd calliotel-dashboard
cp .env.example .env
# Edit .env: replace all REPLACE_* values (POSTGRES_PASSWORD, JWT_SECRET, RESEND_API_KEY)

docker compose up -d --build
```

- Web: http://localhost:3000  
- API: http://localhost:8000  
- Health: http://localhost:8000/health  
- **Dashboard (after login):** http://localhost:3000/dashboard  

Migrations run automatically when the `api` container starts (`alembic upgrade head`).

JWT is stored in **sessionStorage** (cleared when the browser tab closes).

## Test signup (curl)

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"testpass123"}' | jq
```

Login:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"testpass123"}' | jq -r .access_token)

curl -s http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

Dashboard summary:

```bash
curl -s http://localhost:8000/api/v1/dashboard/summary -H "Authorization: Bearer $TOKEN" | jq
```

Forgot password (logs reset URL if `RESEND_API_KEY` is still a placeholder — check `docker compose logs api`):

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}' | jq
```

## Production (DigitalOcean)

See [docs/deployment-caddy.md](docs/deployment-caddy.md) for `app.calliotel.ai` on the same droplet as the voice agent (Caddy TLS stub).

## Phase 4 — phone picker + activate

After login, open **Numbers** (`/dashboard/numbers`):

1. Assign one of ten mock US numbers (`+1 555 0100` … `0109`).
2. While status is **pending**, you may switch to another available number.
3. Click **Activate Agent** to lock the number and set the agent **online** (dashboard summary reflects activation).

API (Bearer token):

```bash
curl -s http://localhost:8000/api/v1/dashboard/numbers -H "Authorization: Bearer $TOKEN" | jq
curl -s -X POST http://localhost:8000/api/v1/dashboard/numbers/assign \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"number_id":"us-555-0100"}' | jq
curl -s -X POST http://localhost:8000/api/v1/dashboard/numbers/activate \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Scope

**Done:** Phase 1 auth, Phase 2 dashboard home, Phase 3 business setup, Phase 4 phone picker + activate  
**TODO:** Call logs, Stripe billing
CALLOIOTEL_README_md

mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/Dockerfile" << 'CALLOIOTEL_backend__Dockerfile'
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000
CALLOIOTEL_backend__Dockerfile

mkdir -p "$INSTALL_DIR/backend/alembic"
cat > "$INSTALL_DIR/backend/alembic/env.py" << 'CALLOIOTEL_backend__alembic__env_py'
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.models import Tenant, User  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
CALLOIOTEL_backend__alembic__env_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/001_initial_users_tenants.py" << 'CALLOIOTEL_backend__alembic__versions__001_initial_users_tenants_py'
"""initial users and tenants

Revision ID: 001_initial
Revises:
Create Date: 2026-09-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("reset_token", sa.String(length=128), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_table("tenants")
CALLOIOTEL_backend__alembic__versions__001_initial_users_tenants_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/002_tenant_dashboard_fields.py" << 'CALLOIOTEL_backend__alembic__versions__002_tenant_dashboard_fields_py'
"""tenant dashboard summary fields

Revision ID: 002_tenant_dashboard
Revises: 001_initial
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_tenant_dashboard"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("agent_status", sa.String(length=32), nullable=False, server_default="offline"),
    )
    op.add_column("tenants", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("calls_this_month", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("minutes_used", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("billing_status", sa.String(length=32), nullable=False, server_default="trial"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "billing_status")
    op.drop_column("tenants", "minutes_used")
    op.drop_column("tenants", "calls_this_month")
    op.drop_column("tenants", "phone_number")
    op.drop_column("tenants", "agent_status")
CALLOIOTEL_backend__alembic__versions__002_tenant_dashboard_fields_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/003_tenant_business_fields.py" << 'CALLOIOTEL_backend__alembic__versions__003_tenant_business_fields_py'
"""tenant business setup fields

Revision ID: 003_tenant_business
Revises: 002_tenant_dashboard
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_tenant_business"
down_revision: Union[str, None] = "002_tenant_dashboard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("business_name", sa.String(length=255), nullable=True))
    op.add_column("tenants", sa.Column("business_type", sa.String(length=64), nullable=True))
    op.add_column("tenants", sa.Column("business_hours", sa.JSON(), nullable=True))
    op.add_column("tenants", sa.Column("business_services", sa.Text(), nullable=True))
    op.add_column("tenants", sa.Column("business_faq", sa.Text(), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("preferred_language", sa.String(length=8), nullable=False, server_default="en"),
    )
    op.add_column(
        "tenants",
        sa.Column("agent_voice", sa.String(length=16), nullable=False, server_default="female"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "agent_voice")
    op.drop_column("tenants", "preferred_language")
    op.drop_column("tenants", "business_faq")
    op.drop_column("tenants", "business_services")
    op.drop_column("tenants", "business_hours")
    op.drop_column("tenants", "business_type")
    op.drop_column("tenants", "business_name")
CALLOIOTEL_backend__alembic__versions__003_tenant_business_fields_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/004_tenant_phone_fields.py" << 'CALLOIOTEL_backend__alembic__versions__004_tenant_phone_fields_py'
"""tenant phone activation fields

Revision ID: 004_tenant_phone
Revises: 003_tenant_business
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_tenant_phone"
down_revision: Union[str, None] = "003_tenant_business"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("phone_number_id", sa.String(length=64), nullable=True))
    op.add_column(
        "tenants",
        sa.Column(
            "activation_status",
            sa.String(length=32),
            nullable=False,
            server_default="inactive",
        ),
    )
    op.add_column("tenants", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "activated_at")
    op.drop_column("tenants", "activation_status")
    op.drop_column("tenants", "phone_number_id")
CALLOIOTEL_backend__alembic__versions__004_tenant_phone_fields_py

mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/alembic.ini" << 'CALLOIOTEL_backend__alembic_ini'
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
CALLOIOTEL_backend__alembic_ini

mkdir -p "$INSTALL_DIR/backend/app"
cat > "$INSTALL_DIR/backend/app/__init__.py" << 'CALLOIOTEL_backend__app____init___py'

CALLOIOTEL_backend__app____init___py

mkdir -p "$INSTALL_DIR/backend/app/api"
cat > "$INSTALL_DIR/backend/app/api/__init__.py" << 'CALLOIOTEL_backend__app__api____init___py'

CALLOIOTEL_backend__app__api____init___py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/__init__.py" << 'CALLOIOTEL_backend__app__api__v1____init___py'

CALLOIOTEL_backend__app__api__v1____init___py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/auth.py" << 'CALLOIOTEL_backend__app__api__v1__auth_py'
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserMeResponse,
)
from app.services import auth_service
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = auth_service.signup_user(db, email=body.email, password=body.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = auth_service.issue_token_for_user(user)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate_user(db, email=body.email, password=body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=auth_service.issue_token_for_user(user))


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token = auth_service.start_password_reset(db, email=body.email)
    if token is not None:
        send_password_reset_email(to_email=body.email.lower(), reset_token=token)
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    ok = auth_service.complete_password_reset(db, token=body.token, new_password=body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    return MessageResponse(message="Password updated. You can sign in now.")


@router.get("/me", response_model=UserMeResponse)
def me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        tenant_id=current_user.tenant_id,
        tenant_name=current_user.tenant.name,
    )
CALLOIOTEL_backend__app__api__v1__auth_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/dashboard.py" << 'CALLOIOTEL_backend__app__api__v1__dashboard_py'
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    try:
        return dashboard_service.get_dashboard_summary(db, tenant_id=current_user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
CALLOIOTEL_backend__app__api__v1__dashboard_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/numbers.py" << 'CALLOIOTEL_backend__app__api__v1__numbers_py'
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
CALLOIOTEL_backend__app__api__v1__numbers_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/router.py" << 'CALLOIOTEL_backend__app__api__v1__router_py'
from fastapi import APIRouter

from app.api.v1 import auth, dashboard, numbers, setup

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(numbers.router)
api_router.include_router(setup.router)
CALLOIOTEL_backend__app__api__v1__router_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/setup.py" << 'CALLOIOTEL_backend__app__api__v1__setup_py'
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
CALLOIOTEL_backend__app__api__v1__setup_py

mkdir -p "$INSTALL_DIR/backend/app/core"
cat > "$INSTALL_DIR/backend/app/core/config.py" << 'CALLOIOTEL_backend__app__core__config_py'
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://calliotel:local@postgres:5432/calliotel_dashboard"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_public_url: str = "http://localhost:8000"
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    frontend_url: str = "http://localhost:3000"
    resend_api_key: str = ""
    email_from: str = "Calliotel <noreply@calliotel.ai>"


settings = Settings()
CALLOIOTEL_backend__app__core__config_py

mkdir -p "$INSTALL_DIR/backend/app/core"
cat > "$INSTALL_DIR/backend/app/core/deps.py" << 'CALLOIOTEL_backend__app__core__deps_py'
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = (
        db.query(User)
        .options(joinedload(User.tenant))
        .filter(User.id == payload["sub"])
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
CALLOIOTEL_backend__app__core__deps_py

mkdir -p "$INSTALL_DIR/backend/app/core"
cat > "$INSTALL_DIR/backend/app/core/security.py" << 'CALLOIOTEL_backend__app__core__security_py'
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(*, user_id: str, tenant_id: str, email: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "email": email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != "access":
        raise ValueError("Invalid token type")
    return payload


def generate_reset_token() -> str:
    import secrets

    return secrets.token_urlsafe(32)
CALLOIOTEL_backend__app__core__security_py

mkdir -p "$INSTALL_DIR/backend/app/db"
cat > "$INSTALL_DIR/backend/app/db/base.py" << 'CALLOIOTEL_backend__app__db__base_py'
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
CALLOIOTEL_backend__app__db__base_py

mkdir -p "$INSTALL_DIR/backend/app/db"
cat > "$INSTALL_DIR/backend/app/db/session.py" << 'CALLOIOTEL_backend__app__db__session_py'
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
CALLOIOTEL_backend__app__db__session_py

mkdir -p "$INSTALL_DIR/backend/app"
cat > "$INSTALL_DIR/backend/app/main.py" << 'CALLOIOTEL_backend__app__main_py'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(title="Calliotel Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url.rstrip("/")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
CALLOIOTEL_backend__app__main_py

mkdir -p "$INSTALL_DIR/backend/app/models"
cat > "$INSTALL_DIR/backend/app/models/__init__.py" << 'CALLOIOTEL_backend__app__models____init___py'
from app.models.user import Tenant, User

__all__ = ["Tenant", "User"]
CALLOIOTEL_backend__app__models____init___py

mkdir -p "$INSTALL_DIR/backend/app/models"
cat > "$INSTALL_DIR/backend/app/models/user.py" << 'CALLOIOTEL_backend__app__models__user_py'
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), default="My Business")
    agent_status: Mapped[str] = mapped_column(String(32), default="offline")
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activation_status: Mapped[str] = mapped_column(String(32), default="inactive")
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    calls_this_month: Mapped[int] = mapped_column(default=0)
    minutes_used: Mapped[int] = mapped_column(default=0)
    billing_status: Mapped[str] = mapped_column(String(32), default="trial")
    business_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    business_hours: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    business_services: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_faq: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    agent_voice: Mapped[str] = mapped_column(String(16), default="female")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    reset_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
CALLOIOTEL_backend__app__models__user_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/auth.py" << 'CALLOIOTEL_backend__app__schemas__auth_py'
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: str
    email: str
    tenant_id: str
    tenant_name: str


class MessageResponse(BaseModel):
    message: str
CALLOIOTEL_backend__app__schemas__auth_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/dashboard.py" << 'CALLOIOTEL_backend__app__schemas__dashboard_py'
from typing import Literal

from pydantic import BaseModel

AgentStatus = Literal["online", "offline"]
BillingStatus = Literal["trial", "active", "past_due"]


class DashboardSummaryResponse(BaseModel):
    agent_status: AgentStatus
    phone_number: str | None
    calls_this_month: int
    minutes_used: int
    billing_status: BillingStatus
CALLOIOTEL_backend__app__schemas__dashboard_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/numbers.py" << 'CALLOIOTEL_backend__app__schemas__numbers_py'
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ActivationStatus = Literal["inactive", "pending", "active"]


class PhoneNumberItem(BaseModel):
    id: str
    phone_number: str
    available: bool


class PhoneNumbersResponse(BaseModel):
    numbers: list[PhoneNumberItem]
    activation_status: ActivationStatus
    assigned_number_id: str | None = None
    assigned_phone_number: str | None = None
    activated_at: datetime | None = None


class AssignNumberRequest(BaseModel):
    number_id: str = Field(..., min_length=1)


class AssignNumberResponse(BaseModel):
    activation_status: ActivationStatus
    phone_number_id: str
    phone_number: str


class ActivateAgentResponse(BaseModel):
    activation_status: ActivationStatus
    phone_number: str
    agent_status: Literal["online"]
    activated_at: datetime
CALLOIOTEL_backend__app__schemas__numbers_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/setup.py" << 'CALLOIOTEL_backend__app__schemas__setup_py'
from typing import Literal

from pydantic import BaseModel, Field

BusinessType = Literal["restaurant", "salon", "clinic", "real_estate", "other"]
PreferredLanguage = Literal["en", "ar"]
AgentVoice = Literal["female", "male"]

DAY_KEYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


class DayHours(BaseModel):
    open: str = "09:00"
    close: str = "17:00"
    closed: bool = False


class BusinessSetupResponse(BaseModel):
    business_name: str | None
    business_type: BusinessType | None
    business_hours: dict[str, DayHours] | None
    business_services: str | None
    business_faq: str | None
    preferred_language: PreferredLanguage
    agent_voice: AgentVoice


class BusinessSetupUpdate(BaseModel):
    business_name: str | None = Field(default=None, max_length=255)
    business_type: BusinessType | None = None
    business_hours: dict[str, DayHours] | None = None
    business_services: str | None = None
    business_faq: str | None = None
    preferred_language: PreferredLanguage = "en"
    agent_voice: AgentVoice = "female"


def default_business_hours() -> dict[str, dict]:
    return {day: {"open": "09:00", "close": "17:00", "closed": False} for day in DAY_KEYS}
CALLOIOTEL_backend__app__schemas__setup_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/auth_service.py" << 'CALLOIOTEL_backend__app__services__auth_service_py'
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    verify_password,
)
from app.models.user import Tenant, User


def signup_user(db: Session, *, email: str, password: str) -> User:
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise ValueError("Email already registered")
    tenant = Tenant(name="My Business")
    db.add(tenant)
    db.flush()
    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_for_user(user: User) -> str:
    return create_access_token(user_id=user.id, tenant_id=user.tenant_id, email=user.email)


def start_password_reset(db: Session, *, email: str) -> str | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None:
        return None
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(UTC) + timedelta(hours=1)
    db.commit()
    return token


def complete_password_reset(db: Session, *, token: str, new_password: str) -> bool:
    user = db.query(User).filter(User.reset_token == token).first()
    if user is None:
        return False
    if user.reset_token_expires_at is None or user.reset_token_expires_at < datetime.now(UTC):
        return False
    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    return True
CALLOIOTEL_backend__app__services__auth_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/dashboard_service.py" << 'CALLOIOTEL_backend__app__services__dashboard_service_py'
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
CALLOIOTEL_backend__app__services__dashboard_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/email_service.py" << 'CALLOIOTEL_backend__app__services__email_service_py'
import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(*, to_email: str, reset_token: str) -> None:
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
    subject = "Reset your Calliotel password"
    html = f"""
    <p>You requested a password reset for Calliotel.</p>
    <p><a href="{reset_url}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    """

    if not settings.resend_api_key or settings.resend_api_key.startswith("REPLACE_"):
        logger.warning(
            "RESEND_API_KEY not configured; password reset link for %s: %s",
            to_email,
            reset_url,
        )
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )
CALLOIOTEL_backend__app__services__email_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/number_service.py" << 'CALLOIOTEL_backend__app__services__number_service_py'
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
CALLOIOTEL_backend__app__services__number_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/setup_service.py" << 'CALLOIOTEL_backend__app__services__setup_service_py'
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
CALLOIOTEL_backend__app__services__setup_service_py

mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/requirements.txt" << 'CALLOIOTEL_backend__requirements_txt'
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sqlalchemy>=2.0.36
alembic>=1.14.0
psycopg[binary]>=3.2.0
pydantic-settings>=2.6.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
bcrypt<4.1
email-validator>=2.2.0
resend>=2.5.0
python-multipart>=0.0.12
CALLOIOTEL_backend__requirements_txt

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/docker-compose.yml" << 'CALLOIOTEL_docker_compose_yml'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-calliotel}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:-calliotel_dashboard}
    volumes:
      - dashboard_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-calliotel} -d ${POSTGRES_DB:-calliotel_dashboard}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: ${DATABASE_URL}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  dashboard_pg_data:
CALLOIOTEL_docker_compose_yml

mkdir -p "$INSTALL_DIR/docs"
cat > "$INSTALL_DIR/docs/deployment-caddy.md" << 'CALLOIOTEL_docs__deployment_caddy_md'
# Deploy dashboard on DigitalOcean (165.227.167.89)

Target hostname: **app.calliotel.ai**

## Overview

1. Point DNS `app.calliotel.ai` → droplet IP.
2. Clone repo, configure `calliotel-dashboard/.env` with production URLs and secrets.
3. Run `docker compose up -d --build` in `calliotel-dashboard/`.
4. Install **Caddy** on the host (or a `caddy` container) to reverse-proxy:
   - `app.calliotel.ai` → `localhost:3000` (Next.js)
   - `/api/*` can proxy to `localhost:8000` **or** set `NEXT_PUBLIC_API_URL=https://app.calliotel.ai` and proxy `/api` to the API service.

## Example Caddyfile (host)

```caddy
app.calliotel.ai {
    reverse_proxy /api/* localhost:8000
    reverse_proxy localhost:3000
}
```

## Env (production)

```env
API_PUBLIC_URL=https://app.calliotel.ai
FRONTEND_URL=https://app.calliotel.ai
NEXT_PUBLIC_API_URL=https://app.calliotel.ai
```

Use strong `POSTGRES_PASSWORD`, `JWT_SECRET`, and a verified Resend sender domain for `EMAIL_FROM`.

## Coexistence with voice stack

Voice agent compose lives under `/opt/calliotel/voice-ai-platform`. Dashboard compose is separate under `/opt/calliotel/calliotel-dashboard`. Monitor RAM on 8GB droplets.
CALLOIOTEL_docs__deployment_caddy_md

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/Dockerfile" << 'CALLOIOTEL_frontend__Dockerfile'
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
CALLOIOTEL_frontend__Dockerfile

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/next-env.d.ts" << 'CALLOIOTEL_frontend__next_env_d_ts'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
CALLOIOTEL_frontend__next_env_d_ts

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/next.config.js" << 'CALLOIOTEL_frontend__next_config_js'
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
CALLOIOTEL_frontend__next_config_js

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/package-lock.json" << 'CALLOIOTEL_frontend__package_lock_json'
{
  "name": "calliotel-dashboard-web",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "calliotel-dashboard-web",
      "version": "0.1.0",
      "dependencies": {
        "next": "^15.1.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "@types/node": "^22.10.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "autoprefixer": "^10.4.20",
        "postcss": "^8.4.49",
        "tailwindcss": "^3.4.16",
        "typescript": "^5.7.2"
      }
    },
    "node_modules/@alloc/quick-lru": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/@alloc/quick-lru/-/quick-lru-5.3.0.tgz",
      "integrity": "sha512-U4+70Pc5ZS9osnCBCE5Jha/ciHM+Yp+CNMNC/7HvYbNRk1Ldd+f7qO65W5qfhu/TCv+/ozljlXXe9Nj8419DMA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.11.3",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
      "integrity": "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@img/colour": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@img/sharp-darwin-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.5.tgz",
      "integrity": "sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-darwin-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.5.tgz",
      "integrity": "sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-freebsd-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.5.tgz",
      "integrity": "sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw==",
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "dependencies": {
        "@img/sharp-wasm32": "0.35.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.4.tgz",
      "integrity": "sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.4.tgz",
      "integrity": "sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.3.4.tgz",
      "integrity": "sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw==",
      "cpu": [
        "arm"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.4.tgz",
      "integrity": "sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-ppc64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.3.4.tgz",
      "integrity": "sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ==",
      "cpu": [
        "ppc64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-riscv64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.3.4.tgz",
      "integrity": "sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q==",
      "cpu": [
        "riscv64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-s390x": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.3.4.tgz",
      "integrity": "sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ==",
      "cpu": [
        "s390x"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.3.4.tgz",
      "integrity": "sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.3.4.tgz",
      "integrity": "sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.3.4.tgz",
      "integrity": "sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-linux-arm": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.35.5.tgz",
      "integrity": "sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ==",
      "cpu": [
        "arm"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.35.5.tgz",
      "integrity": "sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-ppc64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.35.5.tgz",
      "integrity": "sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA==",
      "cpu": [
        "ppc64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-ppc64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-riscv64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.35.5.tgz",
      "integrity": "sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ==",
      "cpu": [
        "riscv64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-riscv64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-s390x": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.35.5.tgz",
      "integrity": "sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA==",
      "cpu": [
        "s390x"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-s390x": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.35.5.tgz",
      "integrity": "sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.35.5.tgz",
      "integrity": "sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.35.5.tgz",
      "integrity": "sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.35.5.tgz",
      "integrity": "sha512-Ptsga1su4tQx+LLF1ECS9U6nz5kmrXKo6XVbtR48Ke3ZRxxgaWBu7IDtEe1quo8hiupwm6WFqxVlXaSf7IINGQ==",
      "license": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/runtime": "^1.11.3"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-webcontainers-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-webcontainers-wasm32/-/sharp-webcontainers-wasm32-0.35.5.tgz",
      "integrity": "sha512-hfhF/FmoQyTUkA0bIKFOtw536BQSeBMe6BF6QyWlrPxT754+TFLaZ7sKKTfvvM0yJgKgaYTwnFCIZ/GuDw5SUA==",
      "cpu": [
        "wasm32"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/sharp-wasm32": "0.35.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.35.5.tgz",
      "integrity": "sha512-X4t7g+7ZA5DKblCBEXGjUqqemj4vczING/5viFwAL8h4N3qYeyjwdCvRLHi4EdOUI+2Z7UFlp1VM+p/AuEtm6Q==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-ia32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.35.5.tgz",
      "integrity": "sha512-5Zm82LoBc43nhwNybZlG7Y1KO//Zhsn306fQl29ZOuStHLGTo3BWL83q3cznX0poxSAMuYL1On/BHBxkBeKr6A==",
      "cpu": [
        "ia32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.35.5.tgz",
      "integrity": "sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.6.0.tgz",
      "integrity": "sha512-T7jf+5zgsZHwNJ4lvQ7/aezbyk0nNX+zJVWpmHA7VYsEx7a7qr5Rg5IbtJFqkgze5Y2sruq1RUY8Q837Od7iFw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@next/env": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-15.5.26.tgz",
      "integrity": "sha512-NJBz9q10LU9h3KjHLEbdgWIV+ow/x+MYzKBRfqhm9/QmML3tPMhYmXF/UIV9SDVCNtOqFNc5oX7kZqeiigMCEA==",
      "license": "MIT"
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-15.5.26.tgz",
      "integrity": "sha512-So8eoJxIcXw/TexNUvvh3uY72J9nDo5BpJsAwUKx+FK57CrWXg6RqVufV7U9OT3BO+siMzJ2FuAwBhaHoPlLGg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-15.5.26.tgz",
      "integrity": "sha512-jImzLUTClVWKhP91e5sgDumjxCLhaFSt7DuN5cnRYw99Dppxxhhq5jKRyDa2aTv3JE7dQmTSTsY3EFkSOp9Pog==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-15.5.26.tgz",
      "integrity": "sha512-CaWd+T/Lud2BmZbrsa1CzCnIOdU3YX9Nuk89virZaSB1O+C+8Yrrevgmnl68u4dvZIfOAzQ77S+Njrq7v1XwSA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-15.5.26.tgz",
      "integrity": "sha512-97AyKI34yjpaudlkWHswAf7c1PjWQAC7lLyrw3R5K+bq834EOA+9IG68rIVy0VqrqGjtPSMjJmMmgeJ3wHR5og==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-15.5.26.tgz",
      "integrity": "sha512-eVtuOCew1sBPV7BEgxy7qxuVyqoU3tJIS/xDZwa1/NiQ4Q0LM2JMH7rny+/uVIN6hsQ3PTb0hTQWypA0L2QxtA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-15.5.26.tgz",
      "integrity": "sha512-EiUXADp+Z+OdQnSqbX10YgOSUrs0CXVODoTfySfsP2jdhngn9bq5RJd376FJzqMPe/XX25FMr1aXtYUVPA0qDw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-15.5.26.tgz",
      "integrity": "sha512-HPl41fgkC4kdM5CCIoqNW6KlKEj1N+xS6bjNFFxDNKooUNUu09frgD948zo95TPw/C3XINZpkdkBGNU2RhjEnw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-15.5.26.tgz",
      "integrity": "sha512-TgmJ5ginKr34RPsz01/swpYtFBxh51d66jM26aytpE6NIypU5KtBVI8C2hJjUNpWr7v6sWj8a6+og2MyntcnpA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.15",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.15.tgz",
      "integrity": "sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==",
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.8.0"
      }
    },
    "node_modules/@types/node": {
      "version": "22.20.4",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-22.20.4.tgz",
      "integrity": "sha512-zJRE40jpHtKqE/C4fgHrAKQLJuSpzEnP9ff9Y7YtoR3Wd2pwqzlekDeEuUQXjRd+QCYnVnNwuJYmhdk9XV8gvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/react": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz",
      "integrity": "sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.3.0.tgz",
      "integrity": "sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^19.3.0"
      }
    },
    "node_modules/any-promise": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/any-promise/-/any-promise-1.3.0.tgz",
      "integrity": "sha512-7UvmKalWRt1wgjL1RrGxoSJW/0QZFIegpeGvZG9kjp8vrRu55XTHbwnqq2GpXm9uLbcuhxm3IqX9OB4MZR1b2A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/anymatch": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/anymatch/-/anymatch-3.1.3.tgz",
      "integrity": "sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.4"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/arg": {
      "version": "5.0.2",
      "resolved": "https://registry.npmjs.org/arg/-/arg-5.0.2.tgz",
      "integrity": "sha512-PYjyFOLKQ9y57JvQ6QLo8dAgNqswh8M1RMJYdQduT6xbWSgK36P/Z/v+p888pM69jMMfS8Xd8F6I1kQ/I9HUGg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/autoprefixer": {
      "version": "10.6.1",
      "resolved": "https://registry.npmjs.org/autoprefixer/-/autoprefixer-10.6.1.tgz",
      "integrity": "sha512-cL1Qz6ADZhcEbny/8HPfe99J6HhNoYtpX2LFLIbhgGE7Q1hlQVkYFdetDN7Id3KiQxhDrHwzlHr/YQCnZ8+xSA==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/autoprefixer"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "browserslist": "^4.28.9",
        "caniuse-lite": "^1.0.30001810",
        "fraction.js": "^5.3.4",
        "picocolors": "^1.1.1",
        "postcss-value-parser": "^4.2.0"
      },
      "bin": {
        "autoprefixer": "bin/autoprefixer"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      },
      "peerDependencies": {
        "postcss": "^8.1.0"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.26",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.26.tgz",
      "integrity": "sha512-GLQdD3y6UF8iVuMJl5fHgE4jdn/ua7n+toKfLgNlg3BqQtOZjpy68T8Tup8/wGWZCDlm7KMg7tPb4MPn7oN0TQ==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/binary-extensions": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/binary-extensions/-/binary-extensions-2.3.0.tgz",
      "integrity": "sha512-Ceh+7ox5qe7LJuLHoY0feh3pHuUDHAcRUeyL2VYghZwfpkNIy/+8Ocg0a3UuSoYzavmylwuLWQOf3hl0jjMMIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.29.3",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.3.tgz",
      "integrity": "sha512-1R4kiYKXGViqEN0CnoDrXc1StD9niAwu+j2dukWzrD4bJgsD4lDmEp0CRbc6E/vYJIfTHwPmwyaKtVSudICdPA==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "baseline-browser-mapping": "^2.11.26",
        "caniuse-lite": "^1.0.30001813",
        "electron-to-chromium": "^1.5.439",
        "node-releases": "^2.0.57",
        "update-browserslist-db": "^1.3.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/camelcase-css": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/camelcase-css/-/camelcase-css-2.0.1.tgz",
      "integrity": "sha512-QOSvevhslijgYwRx6Rv7zKdMF8lbRmx+uQGx2+vDc+KI/eBnsy9kit5aj23AgGu3pa4t9AgwbnXWqS+iOY+2aA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001813",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001813.tgz",
      "integrity": "sha512-zfjJo4rM0+fUomGDBW/xcDjhIwz/210DGvip2MAMDZ8KHcRPnOHmEgHPZP0UHlZoxr8fYKVJOqcORhYQcG4FKQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chokidar": {
      "version": "3.6.0",
      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz",
      "integrity": "sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "anymatch": "~3.1.2",
        "braces": "~3.0.2",
        "glob-parent": "~5.1.2",
        "is-binary-path": "~2.1.0",
        "is-glob": "~4.0.1",
        "normalize-path": "~3.0.0",
        "readdirp": "~3.6.0"
      },
      "engines": {
        "node": ">= 8.10.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/chokidar/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/client-only/-/client-only-0.0.1.tgz",
      "integrity": "sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==",
      "license": "MIT"
    },
    "node_modules/commander": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/commander/-/commander-4.1.1.tgz",
      "integrity": "sha512-NOKm8xhkzAjzFx8B2v5OAHT+u5pRQc2UCa2Vq9jYL/31o2wi9mxBA7LIFs3sV5VSC49z6pEhfbMULvShKj26WA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/cssesc": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/cssesc/-/cssesc-3.0.0.tgz",
      "integrity": "sha512-/Tb/JcjK111nNScGob5MNtsntNM1aCNUDipB/TkwZFhyDrrE47SOx/18wF2bbjgc3ZzCSKW1T5nt5EbFoAz/Vg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "cssesc": "bin/cssesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "resolved": "https://registry.npmjs.org/csstype/-/csstype-3.2.3.tgz",
      "integrity": "sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "license": "Apache-2.0",
      "optional": true,
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/didyoumean": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/didyoumean/-/didyoumean-1.2.2.tgz",
      "integrity": "sha512-gxtyfqMg7GKyhQmb056K7M3xszy/myH8w+B4RT+QXBQsvAOdc3XymqDDPHx1BgPgsdAA5SIifona89YtRATDzw==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/dlv": {
      "version": "1.1.3",
      "resolved": "https://registry.npmjs.org/dlv/-/dlv-1.1.3.tgz",
      "integrity": "sha512-+HlytyjlPKnIG8XuRG8WvmBP8xs8P71y+SKKS6ZXWoEgLuePxtDoUEiH7WkdePWrQ5JBpE6aoVqfZfJUQkjXwA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.441",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.441.tgz",
      "integrity": "sha512-b84H5dyxtHtXYbJRJPLvbS+iud4ys2GVZ61BH7/9lJrfCcIL+Sk+Vh2AW6beaErTdstvjZLgEwkE2j0fZlmwRA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz",
      "integrity": "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz",
      "integrity": "sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fastq": {
      "version": "1.20.3",
      "resolved": "https://registry.npmjs.org/fastq/-/fastq-1.20.3.tgz",
      "integrity": "sha512-XKv5nnLs6nLF71NgiKJLIZFLkPyIEuOselLG7ujZnGrRfQK8HpvY+WqKhAJUAdLomwVHErVS4LfxFlPq0/FTAw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/fraction.js": {
      "version": "5.3.4",
      "resolved": "https://registry.npmjs.org/fraction.js/-/fraction.js-5.3.4.tgz",
      "integrity": "sha512-1X1NTtiJphryn/uLQz3whtY6jK3fTqoE3ohKs0tT+Ujr1W59oopxmoEh7Lu5p6vBaPbgoM0bzveAW4Qi5RyWDQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "*"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/rawify"
      }
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.4.tgz",
      "integrity": "sha512-T2UbfbBEF32wiepXIsMlTW9+dDYC6wMh/t/vYA4tuOMKqWz/n3vr1NFSxQiyP+zk2mXsoMA/i/7qV6LKut1t1A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/is-binary-path": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
      "integrity": "sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "binary-extensions": "^2.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.17.0",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.17.0.tgz",
      "integrity": "sha512-J/vG0zBCbIKOQFfufSwyXdMrsohyJIUNkrnmo6WZGzoM7tr/lsbfW5b2BvisL6zsyMzK9UxV9L6c7AoFbyXHOA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/jiti": {
      "version": "1.21.7",
      "resolved": "https://registry.npmjs.org/jiti/-/jiti-1.21.7.tgz",
      "integrity": "sha512-/imKNG4EbWNrVjoNC/1H5/9GFy+tqjGBHCaSsN+P2RnPqjsLmv6UD3Ej+Kj8nBWaRAwyk7kK5ZUc+OEatnTR3A==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jiti": "bin/jiti.js"
      }
    },
    "node_modules/lilconfig": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/lilconfig/-/lilconfig-3.1.3.tgz",
      "integrity": "sha512-/vlFKAoH5Cgt3Ie+JLhRbwOsCQePABiU3tJ1egGvyQ+33R/vcwM2Zl2QR/LzjsBeItPt3oSVXapn+m4nQDvpzw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/antonk52"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/lines-and-columns/-/lines-and-columns-1.2.4.tgz",
      "integrity": "sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/mz": {
      "version": "2.7.0",
      "resolved": "https://registry.npmjs.org/mz/-/mz-2.7.0.tgz",
      "integrity": "sha512-z81GNO7nnYMEhrGh9LeymoE4+Yr0Wn5McHIZMK5cfQCl+NDX08sCZgUc9/6MHni9IWuFLm1Z3HTCXu2z9fN62Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0",
        "object-assign": "^4.0.1",
        "thenify-all": "^1.0.0"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.19",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.19.tgz",
      "integrity": "sha512-Y2tUNy4ouw6tq5oDSKeQYGOyhkUBhNOcGV/02KC+6kd9eDGqdZd++mjMiIDilrBYvjEnCYvVtsuHCuP+okSfug==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/next": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/next/-/next-15.5.26.tgz",
      "integrity": "sha512-EVCqhvq8Hs+nX9udH2VzE/iXAg9QodZBZnwVJTuAMl386GIYvlJtYhFytV9nSlDYxKw3kEyv8I2dCQs0+on0sQ==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "15.5.26",
        "@swc/helpers": "0.5.15",
        "caniuse-lite": "^1.0.30001579",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.6"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": "^18.18.0 || ^19.8.0 || >= 20.0.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "15.5.26",
        "@next/swc-darwin-x64": "15.5.26",
        "@next/swc-linux-arm64-gnu": "15.5.26",
        "@next/swc-linux-arm64-musl": "15.5.26",
        "@next/swc-linux-x64-gnu": "15.5.26",
        "@next/swc-linux-x64-musl": "15.5.26",
        "@next/swc-win32-arm64-msvc": "15.5.26",
        "@next/swc-win32-x64-msvc": "15.5.26",
        "sharp": "^0.34.3 || ^0.35.4"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.51.1",
        "babel-plugin-react-compiler": "*",
        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "babel-plugin-react-compiler": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/next/node_modules/postcss": {
      "version": "8.4.31",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.31.tgz",
      "integrity": "sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.6",
        "picocolors": "^1.0.0",
        "source-map-js": "^1.0.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.57",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.57.tgz",
      "integrity": "sha512-kQK9LGGFiHtrWiNhZtA7Qbw17AQz+dmsEKODRIVTXA9+e5MS/2gZEBhYJt13GrAz5/IOZKddH/0Z3TP/Zgo+yw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/normalize-path": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/normalize-path/-/normalize-path-3.0.0.tgz",
      "integrity": "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz",
      "integrity": "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-hash": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/object-hash/-/object-hash-3.0.0.tgz",
      "integrity": "sha512-RSn9F68PjH9HqtltsSnqYC1XXoWe9Bju5+213R98cNGttag9q9yAOTzdbsqvIa7aNm5WffBZFpWYr2aWrklWAw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.2",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/pirates/-/pirates-4.0.7.tgz",
      "integrity": "sha512-TfySrs/5nm8fQJDcBDuUng3VOUKsd7S+zqvbOTiGXHfxX4wK31ard+hoNuvkicM/2YFzlpDgABOevKSsB4G/FA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.28",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.18",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/postcss-import": {
      "version": "15.1.0",
      "resolved": "https://registry.npmjs.org/postcss-import/-/postcss-import-15.1.0.tgz",
      "integrity": "sha512-hpr+J05B2FVYUAXHeK1YyI267J/dDDhMU6B6civm8hSY1jYJnBXxzKDKDswzJmtLHryrjhnDjqqp/49t8FALew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "postcss-value-parser": "^4.0.0",
        "read-cache": "^1.0.0",
        "resolve": "^1.1.7"
      },
      "engines": {
        "node": ">=14.0.0"
      },
      "peerDependencies": {
        "postcss": "^8.0.0"
      }
    },
    "node_modules/postcss-js": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/postcss-js/-/postcss-js-4.1.0.tgz",
      "integrity": "sha512-oIAOTqgIo7q2EOwbhb8UalYePMvYoIeRY2YKntdpFQXNosSu3vLrniGgmH9OKs/qAkfoj5oB3le/7mINW1LCfw==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "camelcase-css": "^2.0.1"
      },
      "engines": {
        "node": "^12 || ^14 || >= 16"
      },
      "peerDependencies": {
        "postcss": "^8.4.21"
      }
    },
    "node_modules/postcss-load-config": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/postcss-load-config/-/postcss-load-config-6.0.1.tgz",
      "integrity": "sha512-oPtTM4oerL+UXmx+93ytZVN82RrlY/wPUV8IeDxFrzIjXOLF1pN+EmKPLbubvKHT2HC20xXsCAH2Z+CKV6Oz/g==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "lilconfig": "^3.1.1"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "jiti": ">=1.21.0",
        "postcss": ">=8.0.9",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/postcss-nested": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/postcss-nested/-/postcss-nested-6.2.0.tgz",
      "integrity": "sha512-HQbt28KulC5AJzG+cZtj9kvKB93CFCdLvog1WFLf1D+xmMvPGlBstkpTEZfK5+AN9hfJocyBFCNiqyS48bpgzQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "postcss-selector-parser": "^6.1.1"
      },
      "engines": {
        "node": ">=12.0"
      },
      "peerDependencies": {
        "postcss": "^8.2.14"
      }
    },
    "node_modules/postcss-selector-parser": {
      "version": "6.1.4",
      "resolved": "https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-6.1.4.tgz",
      "integrity": "sha512-bIoJLOmjCO1S9XdY/DcnR5hJxvrDir1PbGChrzXG3vw0/FOliy/fA3dmdhQ441kah4gKv+TwckGzex6wNS5cnQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cssesc": "^3.0.0",
        "util-deprecate": "^1.0.2"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/postcss-value-parser": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/postcss-value-parser/-/postcss-value-parser-4.2.0.tgz",
      "integrity": "sha512-1NNCs6uurfkVbeXG4S8JFT9t19m45ICnif8zWLd5oPSZ50QnwMfK+H3jv408d4jw/7Bttv5axS5IiHoLaVNHeQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/react": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/react/-/react-19.3.0.tgz",
      "integrity": "sha512-E8LUcbtBWt20bbl2YoHfx4ZDBdxVTfOKtCZn9cDSJ4l6/nuoApcpIBcj47t2wZoVX8g2ZHuMHbiShgCR1T5Sog==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.3.0.tgz",
      "integrity": "sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.28.0"
      },
      "peerDependencies": {
        "react": "^19.3.0"
      }
    },
    "node_modules/read-cache": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/read-cache/-/read-cache-1.0.2.tgz",
      "integrity": "sha512-/peqiBB/n07gQGLsWaHho3WfvUyRscw0gYTsEFMhrIe/nWLkYaf5SbKYjGYqtRV3aPwykJgF2VEMo1ac4bnsGA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/readdirp": {
      "version": "3.6.0",
      "resolved": "https://registry.npmjs.org/readdirp/-/readdirp-3.6.0.tgz",
      "integrity": "sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "picomatch": "^2.2.1"
      },
      "engines": {
        "node": ">=8.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.12",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.12.tgz",
      "integrity": "sha512-TyeJ1zif53BPfHootBGwPRYT1RUt6oGWsaQr8UyZW/eAm9bKoijtvruSDEmZHm92CwS9nj7/fWttqPCgzep8CA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz",
      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz",
      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/scheduler": {
      "version": "0.28.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.28.0.tgz",
      "integrity": "sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA1+xKBmHXJsczAw==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.8.5",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.5.tgz",
      "integrity": "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==",
      "license": "ISC",
      "optional": true,
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/sharp": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.35.5.tgz",
      "integrity": "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==",
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/colour": "^1.1.0",
        "detect-libc": "^2.1.2",
        "semver": "^7.8.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-darwin-arm64": "0.35.5",
        "@img/sharp-darwin-x64": "0.35.5",
        "@img/sharp-freebsd-wasm32": "0.35.5",
        "@img/sharp-libvips-darwin-arm64": "1.3.4",
        "@img/sharp-libvips-darwin-x64": "1.3.4",
        "@img/sharp-libvips-linux-arm": "1.3.4",
        "@img/sharp-libvips-linux-arm64": "1.3.4",
        "@img/sharp-libvips-linux-ppc64": "1.3.4",
        "@img/sharp-libvips-linux-riscv64": "1.3.4",
        "@img/sharp-libvips-linux-s390x": "1.3.4",
        "@img/sharp-libvips-linux-x64": "1.3.4",
        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4",
        "@img/sharp-libvips-linuxmusl-x64": "1.3.4",
        "@img/sharp-linux-arm": "0.35.5",
        "@img/sharp-linux-arm64": "0.35.5",
        "@img/sharp-linux-ppc64": "0.35.5",
        "@img/sharp-linux-riscv64": "0.35.5",
        "@img/sharp-linux-s390x": "0.35.5",
        "@img/sharp-linux-x64": "0.35.5",
        "@img/sharp-linuxmusl-arm64": "0.35.5",
        "@img/sharp-linuxmusl-x64": "0.35.5",
        "@img/sharp-webcontainers-wasm32": "0.35.5",
        "@img/sharp-win32-arm64": "0.35.5",
        "@img/sharp-win32-ia32": "0.35.5",
        "@img/sharp-win32-x64": "0.35.5"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        }
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.6",
      "resolved": "https://registry.npmjs.org/styled-jsx/-/styled-jsx-5.1.6.tgz",
      "integrity": "sha512-qSVyDTeMotdvQYoHWLNGwRFJHC+i+ZvdBRYosOFgC+Wg1vx4frN2/RG/NA7SYqqvKNLf39P2LSRA2pu6n0XYZA==",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0 || ^19.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/sucrase": {
      "version": "3.35.1",
      "resolved": "https://registry.npmjs.org/sucrase/-/sucrase-3.35.1.tgz",
      "integrity": "sha512-DhuTmvZWux4H1UOnWMB3sk0sbaCVOoQZjv8u1rDoTV0HTdGem9hkAZtl4JZy8P2z4Bg0nT+YMeOFyVr4zcG5Tw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.2",
        "commander": "^4.0.0",
        "lines-and-columns": "^1.1.6",
        "mz": "^2.7.0",
        "pirates": "^4.0.1",
        "tinyglobby": "^0.2.11",
        "ts-interface-checker": "^0.1.9"
      },
      "bin": {
        "sucrase": "bin/sucrase",
        "sucrase-node": "bin/sucrase-node"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tailwindcss": {
      "version": "3.4.19",
      "resolved": "https://registry.npmjs.org/tailwindcss/-/tailwindcss-3.4.19.tgz",
      "integrity": "sha512-3ofp+LL8E+pK/JuPLPggVAIaEuhvIz4qNcf3nA1Xn2o/7fb7s/TYpHhwGDv1ZU3PkBluUVaF8PyCHcm48cKLWQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@alloc/quick-lru": "^5.2.0",
        "arg": "^5.0.2",
        "chokidar": "^3.6.0",
        "didyoumean": "^1.2.2",
        "dlv": "^1.1.3",
        "fast-glob": "^3.3.2",
        "glob-parent": "^6.0.2",
        "is-glob": "^4.0.3",
        "jiti": "^1.21.7",
        "lilconfig": "^3.1.3",
        "micromatch": "^4.0.8",
        "normalize-path": "^3.0.0",
        "object-hash": "^3.0.0",
        "picocolors": "^1.1.1",
        "postcss": "^8.4.47",
        "postcss-import": "^15.1.0",
        "postcss-js": "^4.0.1",
        "postcss-load-config": "^4.0.2 || ^5.0 || ^6.0",
        "postcss-nested": "^6.2.0",
        "postcss-selector-parser": "^6.1.2",
        "resolve": "^1.22.8",
        "sucrase": "^3.35.0"
      },
      "bin": {
        "tailwind": "lib/cli.js",
        "tailwindcss": "lib/cli.js"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/thenify": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/thenify/-/thenify-3.3.1.tgz",
      "integrity": "sha512-RVZSIV5IG10Hk3enotrhvz0T9em6cyHBLkH/YAZuKqd8hRkKhSfCGIcP2KUY0EPxndzANBmNllzWPwak+bheSw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0"
      }
    },
    "node_modules/thenify-all": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/thenify-all/-/thenify-all-1.6.0.tgz",
      "integrity": "sha512-RNxQH/qI8/t3thXJDwcstUO4zeqo64+Uy/+sNVRBx4Xn2OX+OZ9oP+iJnNFqplFra2ZUVeKCSa2oVWi3T4uVmA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "thenify": ">= 3.1.0 < 4"
      },
      "engines": {
        "node": ">=0.8"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.17.tgz",
      "integrity": "sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyglobby/node_modules/fdir": {
      "version": "6.5.0",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.5.0.tgz",
      "integrity": "sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/tinyglobby/node_modules/picomatch": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz",
      "integrity": "sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-interface-checker": {
      "version": "0.1.13",
      "resolved": "https://registry.npmjs.org/ts-interface-checker/-/ts-interface-checker-0.1.13.tgz",
      "integrity": "sha512-Y/arvbn+rrz3JCKl9C4kVNfTfSm2/mEp5FSz5EsZSANGPSlQrpRI5M4PKF+mJnE52jOO90PnPSc3Ur3bTQw0gA==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      "integrity": "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz",
      "integrity": "sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/update-browserslist-db": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.3.3.tgz",
      "integrity": "sha512-pJ2sYawQS0R/WI928Gj5GlPhTGzbMelq0+4INtSYNDV9ErKJcX6xjGWkoG/VnB3dpUm00zALaqkrUD77pO5TDQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "dev": true,
      "license": "MIT"
    }
  }
}
CALLOIOTEL_frontend__package_lock_json

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/package.json" << 'CALLOIOTEL_frontend__package_json'
{
  "name": "calliotel-dashboard-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.7.2"
  }
}
CALLOIOTEL_frontend__package_json

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/postcss.config.js" << 'CALLOIOTEL_frontend__postcss_config_js'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
CALLOIOTEL_frontend__postcss_config_js

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/forgot-password"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/forgot-password/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___forgot_password__page_tsx'
"use client";

import { FormEvent, useState } from "react";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const data = await apiPost<{ message: string }>("/api/v1/auth/forgot-password", { email });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot password" subtitle="We will email you a reset link">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/login">Back to login</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___forgot_password__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/layout.tsx" << 'CALLOIOTEL_frontend__src__app___auth___layout_tsx'
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
CALLOIOTEL_frontend__src__app___auth___layout_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/login"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/login/login-form.tsx" << 'CALLOIOTEL_frontend__src__app___auth___login__login_form_tsx'
"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";
import { saveAccessToken } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    registered ? "Account created. Sign in below." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const data = await apiPost<{ access_token: string }>("/api/v1/auth/login", {
        email,
        password,
      });
      saveAccessToken(data.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Log in" subtitle="Manage your Calliotel AI agent">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {info ? <p className="text-sm text-green-700">{info}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </p>
      <p className="mt-2 text-center text-sm text-slate-600">
        New here? <AuthLink href="/signup">Create an account</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___login__login_form_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/login"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/login/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___login__page_tsx'
import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-600">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
CALLOIOTEL_frontend__src__app___auth___login__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/reset-password"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/reset-password/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___reset_password__page_tsx'
import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-600">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
CALLOIOTEL_frontend__src__app___auth___reset_password__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/reset-password"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/reset-password/reset-password-form.tsx" << 'CALLOIOTEL_frontend__src__app___auth___reset_password__reset_password_form_tsx'
"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const data = await apiPost<{ message: string }>("/api/v1/auth/reset-password", {
        token,
        password,
      });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="token">
            Reset token
          </label>
          <input
            id="token"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/login">Back to login</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___reset_password__reset_password_form_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/signup"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/signup/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___signup__page_tsx'
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost<{ access_token: string }>("/api/v1/auth/signup", {
        email,
        password,
      });
      router.push("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start your AI phone agent">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account? <AuthLink href="/login">Log in</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___signup__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/billing"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/billing/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__billing__page_tsx'
import { PlaceholderPage } from "@/components/dashboard-shell";

export default function BillingPage() {
  return <PlaceholderPage title="Billing" message="Billing coming soon" />;
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__billing__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/calls"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/calls/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__calls__page_tsx'
import { PlaceholderPage } from "@/components/dashboard-shell";

export default function CallsPage() {
  return <PlaceholderPage title="Call logs" message="Call logs coming soon" />;
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__calls__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/numbers"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/numbers/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__numbers__page_tsx'
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type ActivationStatus = "inactive" | "pending" | "active";

type PhoneNumberItem = {
  id: string;
  phone_number: string;
  available: boolean;
};

type NumbersPayload = {
  numbers: PhoneNumberItem[];
  activation_status: ActivationStatus;
  assigned_number_id: string | null;
  assigned_phone_number: string | null;
  activated_at: string | null;
};

export default function NumbersPage() {
  const [data, setData] = useState<NumbersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const load = useCallback(() => {
    const token = getAccessToken();
    if (!token) return Promise.resolve();
    return apiGet<NumbersPayload>("/api/v1/dashboard/numbers", token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load numbers"));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onAssign(numberId: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(numberId);
    setError(null);
    try {
      await apiPost("/api/v1/dashboard/numbers/assign", { number_id: numberId }, token);
      await load();
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onActivate() {
    const token = getAccessToken();
    if (!token) return;
    setActivating(true);
    setError(null);
    try {
      await apiPost("/api/v1/dashboard/numbers/activate", {}, token);
      await load();
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading phone numbers…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error ?? "Unable to load numbers"}</p>;
  }

  const locked = data.activation_status === "active";
  const pending = data.activation_status === "pending";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Phone numbers</h1>
      <p className="mt-1 text-sm text-slate-600">
        Pick a number for your AI agent, then activate when you are ready to go live.
      </p>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {locked ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">Agent is live</h2>
          <p className="mt-2 text-sm text-green-800">
            Your number <span className="font-semibold">{data.assigned_phone_number}</span> is
            active. The number cannot be changed after activation.
          </p>
          {data.activated_at ? (
            <p className="mt-2 text-xs text-green-700">
              Activated {new Date(data.activated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {pending && data.assigned_phone_number ? (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Number assigned</h2>
          <p className="mt-2 text-sm text-slate-700">
            Selected: <span className="font-semibold">{data.assigned_phone_number}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            You can pick a different available number below before activating.
          </p>
          <button
            type="button"
            disabled={activating}
            onClick={onActivate}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {activating ? "Activating…" : "Activate Agent"}
          </button>
        </div>
      ) : null}

      {!locked ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Number</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.numbers.map((row) => {
                const isCurrent = row.id === data.assigned_number_id;
                const canAssign = row.available && !isCurrent;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.phone_number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {isCurrent ? (
                        <span className="text-brand-700">Your selection</span>
                      ) : row.available ? (
                        "Available"
                      ) : (
                        "In use"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canAssign ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => onAssign(row.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {busyId === row.id ? "Assigning…" : pending ? "Switch" : "Assign"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__numbers__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__page_tsx'
"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type Summary = {
  agent_status: string;
  phone_number: string | null;
  calls_this_month: number;
  minutes_used: number;
  billing_status: string;
};

function StatusBadge({ value }: { value: string }) {
  const online = value === "online";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        online ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      {value}
    </span>
  );
}

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<Summary>("/api/v1/dashboard/summary", token)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load summary"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-600">Loading dashboard…</p>;
  }

  const cards = [
    {
      title: "Agent status",
      value: <StatusBadge value={summary.agent_status} />,
    },
    {
      title: "Phone number",
      value: summary.phone_number ?? "Not assigned",
    },
    {
      title: "Calls this month",
      value: String(summary.calls_this_month),
    },
    {
      title: "Minutes used",
      value: String(summary.minutes_used),
    },
    {
      title: "Billing",
      value: summary.billing_status.replace("_", " "),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Overview of your AI phone agent</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <div className="mt-2 text-lg font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/setup"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/setup/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__setup__page_tsx'
"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type DayHours = { open: string; close: string; closed: boolean };

type SetupData = {
  business_name: string | null;
  business_type: string | null;
  business_hours: Record<string, DayHours>;
  business_services: string | null;
  business_faq: string | null;
  preferred_language: "en" | "ar";
  agent_voice: "female" | "male";
};

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "salon", label: "Salon" },
  { value: "clinic", label: "Clinic" },
  { value: "real_estate", label: "Real estate" },
  { value: "other", label: "Other" },
];

const emptySetup = (): SetupData => ({
  business_name: "",
  business_type: null,
  business_hours: Object.fromEntries(
    DAYS.map((d) => [d.key, { open: "09:00", close: "17:00", closed: false }]),
  ),
  business_services: "",
  business_faq: "",
  preferred_language: "en",
  agent_voice: "female",
});

export default function SetupPage() {
  const [form, setForm] = useState<SetupData>(emptySetup());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<SetupData>("/api/v1/dashboard/setup", token)
      .then((data) => {
        setForm({
          ...data,
          business_name: data.business_name ?? "",
          business_services: data.business_services ?? "",
          business_faq: data.business_faq ?? "",
          business_hours: data.business_hours ?? emptySetup().business_hours,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      await apiPut(
        "/api/v1/dashboard/setup",
        {
          ...form,
          business_name: form.business_name?.trim() || null,
          business_services: form.business_services || null,
          business_faq: form.business_faq || null,
        },
        token,
      );
      setToast("Business setup saved.");
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateDay(key: string, patch: Partial<DayHours>) {
    setForm((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [key]: { ...prev.business_hours[key], ...patch },
      },
    }));
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading setup…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Business setup</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tell your AI agent about your business. This name appears in your dashboard header.
      </p>

      {toast ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_name">
            Business name
          </label>
          <input
            id="business_name"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_name ?? ""}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_type">
            Business type
          </label>
          <select
            id="business_type"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_type ?? ""}
            onChange={(e) =>
              setForm({ ...form, business_type: e.target.value || null })
            }
          >
            <option value="">Select type…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Hours of operation</legend>
          <div className="mt-3 space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = form.business_hours[key];
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="w-24 text-sm font-medium text-slate-700">{label}</span>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={day.closed}
                      onChange={(e) => updateDay(key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="services">
            Services / menu
          </label>
          <textarea
            id="services"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_services ?? ""}
            onChange={(e) => setForm({ ...form, business_services: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="faq">
            FAQ
          </label>
          <textarea
            id="faq"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_faq ?? ""}
            onChange={(e) => setForm({ ...form, business_faq: e.target.value })}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Preferred language</legend>
          <div className="mt-2 flex gap-4">
            {[
              { value: "en", label: "English" },
              { value: "ar", label: "Arabic" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferred_language"
                  checked={form.preferred_language === opt.value}
                  onChange={() =>
                    setForm({ ...form, preferred_language: opt.value as "en" | "ar" })
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Agent voice</legend>
          <div className="mt-2 flex gap-4">
            {[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="agent_voice"
                  checked={form.agent_voice === opt.value}
                  onChange={() =>
                    setForm({ ...form, agent_voice: opt.value as "female" | "male" })
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__setup__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/layout.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___layout_tsx'
"use client";

import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
CALLOIOTEL_frontend__src__app___dashboard___layout_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app"
cat > "$INSTALL_DIR/frontend/src/app/globals.css" << 'CALLOIOTEL_frontend__src__app__globals_css'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}
CALLOIOTEL_frontend__src__app__globals_css

mkdir -p "$INSTALL_DIR/frontend/src/app"
cat > "$INSTALL_DIR/frontend/src/app/layout.tsx" << 'CALLOIOTEL_frontend__src__app__layout_tsx'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calliotel",
  description: "AI phone agents for your business",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
CALLOIOTEL_frontend__src__app__layout_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app"
cat > "$INSTALL_DIR/frontend/src/app/page.tsx" << 'CALLOIOTEL_frontend__src__app__page_tsx'
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
CALLOIOTEL_frontend__src__app__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/components"
cat > "$INSTALL_DIR/frontend/src/components/auth-shell.tsx" << 'CALLOIOTEL_frontend__src__components__auth_shell_tsx'
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Calliotel</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-brand-600 hover:text-brand-700">
      {children}
    </Link>
  );
}
CALLOIOTEL_frontend__src__components__auth_shell_tsx

mkdir -p "$INSTALL_DIR/frontend/src/components"
cat > "$INSTALL_DIR/frontend/src/components/dashboard-shell.tsx" << 'CALLOIOTEL_frontend__src__components__dashboard_shell_tsx'
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { clearAccessToken, getAccessToken, logout } from "@/lib/auth";

type MeResponse = { email: string; tenant_name: string };

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/setup", label: "Setup" },
  { href: "/dashboard/numbers", label: "Numbers" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/billing", label: "Billing" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    function loadMe() {
      const t = getAccessToken();
      if (!t) return;
      apiGet<MeResponse>("/api/v1/auth/me", t)
        .then(setMe)
        .catch(() => {
          clearAccessToken();
          router.replace("/login");
        })
        .finally(() => setReady(true));
    }
    loadMe();
    const onTenantUpdated = () => loadMe();
    window.addEventListener("calliotel:tenant-updated", onTenantUpdated);
    return () => window.removeEventListener("calliotel:tenant-updated", onTenantUpdated);
  }, [router]);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-4 py-5">
          <p className="text-sm font-semibold text-brand-600">Calliotel</p>
          <p className="mt-1 truncate text-xs text-slate-500">{me?.tenant_name}</p>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden">
            <p className="text-sm font-semibold text-brand-600">Calliotel</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-slate-900">{me?.email}</p>
            <p className="hidden text-xs text-slate-500 sm:block">{me?.tenant_name}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ml-4 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                pathname === item.href ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PlaceholderPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </div>
  );
}
CALLOIOTEL_frontend__src__components__dashboard_shell_tsx

mkdir -p "$INSTALL_DIR/frontend/src/lib"
cat > "$INSTALL_DIR/frontend/src/lib/api-client.ts" << 'CALLOIOTEL_frontend__src__lib__api_client_ts'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((d: { msg?: string }) => d.msg).join(", ");
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

export { API_URL };
CALLOIOTEL_frontend__src__lib__api_client_ts

mkdir -p "$INSTALL_DIR/frontend/src/lib"
cat > "$INSTALL_DIR/frontend/src/lib/auth.ts" << 'CALLOIOTEL_frontend__src__lib__auth_ts'
const TOKEN_KEY = "calliotel_access_token";

export function saveAccessToken(token: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

export function logout(): void {
  clearAccessToken();
}
CALLOIOTEL_frontend__src__lib__auth_ts

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/tailwind.config.js" << 'CALLOIOTEL_frontend__tailwind_config_js'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
    },
  },
  plugins: [],
};
CALLOIOTEL_frontend__tailwind_config_js

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/tsconfig.json" << 'CALLOIOTEL_frontend__tsconfig_json'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
CALLOIOTEL_frontend__tsconfig_json

mkdir -p "$INSTALL_DIR/scripts"
cat > "$INSTALL_DIR/scripts/bootstrap-calliotel-dashboard.sh" << 'CALLOIOTEL_scripts__bootstrap_calliotel_dashboard_sh'
#!/usr/bin/env bash
# Bootstrap calliotel-dashboard — macOS/Linux.
set -euo pipefail
INSTALL_DIR="${1:-calliotel-dashboard}"
mkdir -p "$INSTALL_DIR"
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"
echo "Writing calliotel-dashboard to: $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/.env.example" << 'CALLOIOTEL__env_example'
# --- PostgreSQL (docker-compose service: postgres) ---
POSTGRES_USER=calliotel
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
POSTGRES_DB=calliotel_dashboard
DATABASE_URL=postgresql+psycopg://calliotel:REPLACE_WITH_STRONG_PASSWORD@postgres:5432/calliotel_dashboard

# --- FastAPI ---
API_HOST=0.0.0.0
API_PORT=8000
API_PUBLIC_URL=http://localhost:8000
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_URL=http://localhost:3000

# --- Resend (forgot password) ---
RESEND_API_KEY=REPLACE_WITH_YOUR_RESEND_KEY
EMAIL_FROM=Calliotel <noreply@calliotel.ai>

# --- Next.js (browser) ---
NEXT_PUBLIC_API_URL=http://localhost:8000

# --- Production (droplet + Caddy — fill when deploying) ---
# API_PUBLIC_URL=https://app.calliotel.ai
# FRONTEND_URL=https://app.calliotel.ai
# NEXT_PUBLIC_API_URL=https://app.calliotel.ai
CALLOIOTEL__env_example

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/.gitignore" << 'CALLOIOTEL__gitignore'
.env
node_modules/
.next/
__pycache__/
*.pyc
.venv/
CALLOIOTEL__gitignore

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/README.md" << 'CALLOIOTEL_README_md'
# Calliotel client dashboard

Customer-facing app for **app.calliotel.ai**: auth + business dashboard.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind
- **Backend:** FastAPI, SQLAlchemy, Alembic, JWT
- **Database:** PostgreSQL 16
- **Email:** Resend (password reset)

## Quick start (Docker)

```bash
cd calliotel-dashboard
cp .env.example .env
# Edit .env: replace all REPLACE_* values (POSTGRES_PASSWORD, JWT_SECRET, RESEND_API_KEY)

docker compose up -d --build
```

- Web: http://localhost:3000  
- API: http://localhost:8000  
- Health: http://localhost:8000/health  
- **Dashboard (after login):** http://localhost:3000/dashboard  

Migrations run automatically when the `api` container starts (`alembic upgrade head`).

JWT is stored in **sessionStorage** (cleared when the browser tab closes).

## Test signup (curl)

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"testpass123"}' | jq
```

Login:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"testpass123"}' | jq -r .access_token)

curl -s http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

Dashboard summary:

```bash
curl -s http://localhost:8000/api/v1/dashboard/summary -H "Authorization: Bearer $TOKEN" | jq
```

Forgot password (logs reset URL if `RESEND_API_KEY` is still a placeholder — check `docker compose logs api`):

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}' | jq
```

## Production (DigitalOcean)

See [docs/deployment-caddy.md](docs/deployment-caddy.md) for `app.calliotel.ai` on the same droplet as the voice agent (Caddy TLS stub).

## Phase 4 — phone picker + activate

After login, open **Numbers** (`/dashboard/numbers`):

1. Assign one of ten mock US numbers (`+1 555 0100` … `0109`).
2. While status is **pending**, you may switch to another available number.
3. Click **Activate Agent** to lock the number and set the agent **online** (dashboard summary reflects activation).

API (Bearer token):

```bash
curl -s http://localhost:8000/api/v1/dashboard/numbers -H "Authorization: Bearer $TOKEN" | jq
curl -s -X POST http://localhost:8000/api/v1/dashboard/numbers/assign \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"number_id":"us-555-0100"}' | jq
curl -s -X POST http://localhost:8000/api/v1/dashboard/numbers/activate \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Scope

**Done:** Phase 1 auth, Phase 2 dashboard home, Phase 3 business setup, Phase 4 phone picker + activate  
**TODO:** Call logs, Stripe billing
CALLOIOTEL_README_md

mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/Dockerfile" << 'CALLOIOTEL_backend__Dockerfile'
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000
CALLOIOTEL_backend__Dockerfile

mkdir -p "$INSTALL_DIR/backend/alembic"
cat > "$INSTALL_DIR/backend/alembic/env.py" << 'CALLOIOTEL_backend__alembic__env_py'
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.models import Tenant, User  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
CALLOIOTEL_backend__alembic__env_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/001_initial_users_tenants.py" << 'CALLOIOTEL_backend__alembic__versions__001_initial_users_tenants_py'
"""initial users and tenants

Revision ID: 001_initial
Revises:
Create Date: 2026-09-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("reset_token", sa.String(length=128), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_table("tenants")
CALLOIOTEL_backend__alembic__versions__001_initial_users_tenants_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/002_tenant_dashboard_fields.py" << 'CALLOIOTEL_backend__alembic__versions__002_tenant_dashboard_fields_py'
"""tenant dashboard summary fields

Revision ID: 002_tenant_dashboard
Revises: 001_initial
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_tenant_dashboard"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("agent_status", sa.String(length=32), nullable=False, server_default="offline"),
    )
    op.add_column("tenants", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("calls_this_month", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("minutes_used", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("billing_status", sa.String(length=32), nullable=False, server_default="trial"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "billing_status")
    op.drop_column("tenants", "minutes_used")
    op.drop_column("tenants", "calls_this_month")
    op.drop_column("tenants", "phone_number")
    op.drop_column("tenants", "agent_status")
CALLOIOTEL_backend__alembic__versions__002_tenant_dashboard_fields_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/003_tenant_business_fields.py" << 'CALLOIOTEL_backend__alembic__versions__003_tenant_business_fields_py'
"""tenant business setup fields

Revision ID: 003_tenant_business
Revises: 002_tenant_dashboard
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_tenant_business"
down_revision: Union[str, None] = "002_tenant_dashboard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("business_name", sa.String(length=255), nullable=True))
    op.add_column("tenants", sa.Column("business_type", sa.String(length=64), nullable=True))
    op.add_column("tenants", sa.Column("business_hours", sa.JSON(), nullable=True))
    op.add_column("tenants", sa.Column("business_services", sa.Text(), nullable=True))
    op.add_column("tenants", sa.Column("business_faq", sa.Text(), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("preferred_language", sa.String(length=8), nullable=False, server_default="en"),
    )
    op.add_column(
        "tenants",
        sa.Column("agent_voice", sa.String(length=16), nullable=False, server_default="female"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "agent_voice")
    op.drop_column("tenants", "preferred_language")
    op.drop_column("tenants", "business_faq")
    op.drop_column("tenants", "business_services")
    op.drop_column("tenants", "business_hours")
    op.drop_column("tenants", "business_type")
    op.drop_column("tenants", "business_name")
CALLOIOTEL_backend__alembic__versions__003_tenant_business_fields_py

mkdir -p "$INSTALL_DIR/backend/alembic/versions"
cat > "$INSTALL_DIR/backend/alembic/versions/004_tenant_phone_fields.py" << 'CALLOIOTEL_backend__alembic__versions__004_tenant_phone_fields_py'
"""tenant phone activation fields

Revision ID: 004_tenant_phone
Revises: 003_tenant_business
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_tenant_phone"
down_revision: Union[str, None] = "003_tenant_business"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("phone_number_id", sa.String(length=64), nullable=True))
    op.add_column(
        "tenants",
        sa.Column(
            "activation_status",
            sa.String(length=32),
            nullable=False,
            server_default="inactive",
        ),
    )
    op.add_column("tenants", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "activated_at")
    op.drop_column("tenants", "activation_status")
    op.drop_column("tenants", "phone_number_id")
CALLOIOTEL_backend__alembic__versions__004_tenant_phone_fields_py

mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/alembic.ini" << 'CALLOIOTEL_backend__alembic_ini'
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
CALLOIOTEL_backend__alembic_ini

mkdir -p "$INSTALL_DIR/backend/app"
cat > "$INSTALL_DIR/backend/app/__init__.py" << 'CALLOIOTEL_backend__app____init___py'

CALLOIOTEL_backend__app____init___py

mkdir -p "$INSTALL_DIR/backend/app/api"
cat > "$INSTALL_DIR/backend/app/api/__init__.py" << 'CALLOIOTEL_backend__app__api____init___py'

CALLOIOTEL_backend__app__api____init___py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/__init__.py" << 'CALLOIOTEL_backend__app__api__v1____init___py'

CALLOIOTEL_backend__app__api__v1____init___py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/auth.py" << 'CALLOIOTEL_backend__app__api__v1__auth_py'
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserMeResponse,
)
from app.services import auth_service
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = auth_service.signup_user(db, email=body.email, password=body.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = auth_service.issue_token_for_user(user)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate_user(db, email=body.email, password=body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=auth_service.issue_token_for_user(user))


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token = auth_service.start_password_reset(db, email=body.email)
    if token is not None:
        send_password_reset_email(to_email=body.email.lower(), reset_token=token)
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    ok = auth_service.complete_password_reset(db, token=body.token, new_password=body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    return MessageResponse(message="Password updated. You can sign in now.")


@router.get("/me", response_model=UserMeResponse)
def me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        tenant_id=current_user.tenant_id,
        tenant_name=current_user.tenant.name,
    )
CALLOIOTEL_backend__app__api__v1__auth_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/dashboard.py" << 'CALLOIOTEL_backend__app__api__v1__dashboard_py'
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    try:
        return dashboard_service.get_dashboard_summary(db, tenant_id=current_user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
CALLOIOTEL_backend__app__api__v1__dashboard_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/numbers.py" << 'CALLOIOTEL_backend__app__api__v1__numbers_py'
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
CALLOIOTEL_backend__app__api__v1__numbers_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/router.py" << 'CALLOIOTEL_backend__app__api__v1__router_py'
from fastapi import APIRouter

from app.api.v1 import auth, dashboard, numbers, setup

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(numbers.router)
api_router.include_router(setup.router)
CALLOIOTEL_backend__app__api__v1__router_py

mkdir -p "$INSTALL_DIR/backend/app/api/v1"
cat > "$INSTALL_DIR/backend/app/api/v1/setup.py" << 'CALLOIOTEL_backend__app__api__v1__setup_py'
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
CALLOIOTEL_backend__app__api__v1__setup_py

mkdir -p "$INSTALL_DIR/backend/app/core"
cat > "$INSTALL_DIR/backend/app/core/config.py" << 'CALLOIOTEL_backend__app__core__config_py'
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://calliotel:local@postgres:5432/calliotel_dashboard"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_public_url: str = "http://localhost:8000"
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    frontend_url: str = "http://localhost:3000"
    resend_api_key: str = ""
    email_from: str = "Calliotel <noreply@calliotel.ai>"


settings = Settings()
CALLOIOTEL_backend__app__core__config_py

mkdir -p "$INSTALL_DIR/backend/app/core"
cat > "$INSTALL_DIR/backend/app/core/deps.py" << 'CALLOIOTEL_backend__app__core__deps_py'
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = (
        db.query(User)
        .options(joinedload(User.tenant))
        .filter(User.id == payload["sub"])
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
CALLOIOTEL_backend__app__core__deps_py

mkdir -p "$INSTALL_DIR/backend/app/core"
cat > "$INSTALL_DIR/backend/app/core/security.py" << 'CALLOIOTEL_backend__app__core__security_py'
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(*, user_id: str, tenant_id: str, email: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "email": email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != "access":
        raise ValueError("Invalid token type")
    return payload


def generate_reset_token() -> str:
    import secrets

    return secrets.token_urlsafe(32)
CALLOIOTEL_backend__app__core__security_py

mkdir -p "$INSTALL_DIR/backend/app/db"
cat > "$INSTALL_DIR/backend/app/db/base.py" << 'CALLOIOTEL_backend__app__db__base_py'
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
CALLOIOTEL_backend__app__db__base_py

mkdir -p "$INSTALL_DIR/backend/app/db"
cat > "$INSTALL_DIR/backend/app/db/session.py" << 'CALLOIOTEL_backend__app__db__session_py'
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
CALLOIOTEL_backend__app__db__session_py

mkdir -p "$INSTALL_DIR/backend/app"
cat > "$INSTALL_DIR/backend/app/main.py" << 'CALLOIOTEL_backend__app__main_py'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(title="Calliotel Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url.rstrip("/")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
CALLOIOTEL_backend__app__main_py

mkdir -p "$INSTALL_DIR/backend/app/models"
cat > "$INSTALL_DIR/backend/app/models/__init__.py" << 'CALLOIOTEL_backend__app__models____init___py'
from app.models.user import Tenant, User

__all__ = ["Tenant", "User"]
CALLOIOTEL_backend__app__models____init___py

mkdir -p "$INSTALL_DIR/backend/app/models"
cat > "$INSTALL_DIR/backend/app/models/user.py" << 'CALLOIOTEL_backend__app__models__user_py'
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), default="My Business")
    agent_status: Mapped[str] = mapped_column(String(32), default="offline")
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activation_status: Mapped[str] = mapped_column(String(32), default="inactive")
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    calls_this_month: Mapped[int] = mapped_column(default=0)
    minutes_used: Mapped[int] = mapped_column(default=0)
    billing_status: Mapped[str] = mapped_column(String(32), default="trial")
    business_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    business_hours: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    business_services: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_faq: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    agent_voice: Mapped[str] = mapped_column(String(16), default="female")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    reset_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
CALLOIOTEL_backend__app__models__user_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/auth.py" << 'CALLOIOTEL_backend__app__schemas__auth_py'
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: str
    email: str
    tenant_id: str
    tenant_name: str


class MessageResponse(BaseModel):
    message: str
CALLOIOTEL_backend__app__schemas__auth_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/dashboard.py" << 'CALLOIOTEL_backend__app__schemas__dashboard_py'
from typing import Literal

from pydantic import BaseModel

AgentStatus = Literal["online", "offline"]
BillingStatus = Literal["trial", "active", "past_due"]


class DashboardSummaryResponse(BaseModel):
    agent_status: AgentStatus
    phone_number: str | None
    calls_this_month: int
    minutes_used: int
    billing_status: BillingStatus
CALLOIOTEL_backend__app__schemas__dashboard_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/numbers.py" << 'CALLOIOTEL_backend__app__schemas__numbers_py'
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ActivationStatus = Literal["inactive", "pending", "active"]


class PhoneNumberItem(BaseModel):
    id: str
    phone_number: str
    available: bool


class PhoneNumbersResponse(BaseModel):
    numbers: list[PhoneNumberItem]
    activation_status: ActivationStatus
    assigned_number_id: str | None = None
    assigned_phone_number: str | None = None
    activated_at: datetime | None = None


class AssignNumberRequest(BaseModel):
    number_id: str = Field(..., min_length=1)


class AssignNumberResponse(BaseModel):
    activation_status: ActivationStatus
    phone_number_id: str
    phone_number: str


class ActivateAgentResponse(BaseModel):
    activation_status: ActivationStatus
    phone_number: str
    agent_status: Literal["online"]
    activated_at: datetime
CALLOIOTEL_backend__app__schemas__numbers_py

mkdir -p "$INSTALL_DIR/backend/app/schemas"
cat > "$INSTALL_DIR/backend/app/schemas/setup.py" << 'CALLOIOTEL_backend__app__schemas__setup_py'
from typing import Literal

from pydantic import BaseModel, Field

BusinessType = Literal["restaurant", "salon", "clinic", "real_estate", "other"]
PreferredLanguage = Literal["en", "ar"]
AgentVoice = Literal["female", "male"]

DAY_KEYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


class DayHours(BaseModel):
    open: str = "09:00"
    close: str = "17:00"
    closed: bool = False


class BusinessSetupResponse(BaseModel):
    business_name: str | None
    business_type: BusinessType | None
    business_hours: dict[str, DayHours] | None
    business_services: str | None
    business_faq: str | None
    preferred_language: PreferredLanguage
    agent_voice: AgentVoice


class BusinessSetupUpdate(BaseModel):
    business_name: str | None = Field(default=None, max_length=255)
    business_type: BusinessType | None = None
    business_hours: dict[str, DayHours] | None = None
    business_services: str | None = None
    business_faq: str | None = None
    preferred_language: PreferredLanguage = "en"
    agent_voice: AgentVoice = "female"


def default_business_hours() -> dict[str, dict]:
    return {day: {"open": "09:00", "close": "17:00", "closed": False} for day in DAY_KEYS}
CALLOIOTEL_backend__app__schemas__setup_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/auth_service.py" << 'CALLOIOTEL_backend__app__services__auth_service_py'
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    verify_password,
)
from app.models.user import Tenant, User


def signup_user(db: Session, *, email: str, password: str) -> User:
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise ValueError("Email already registered")
    tenant = Tenant(name="My Business")
    db.add(tenant)
    db.flush()
    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_for_user(user: User) -> str:
    return create_access_token(user_id=user.id, tenant_id=user.tenant_id, email=user.email)


def start_password_reset(db: Session, *, email: str) -> str | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None:
        return None
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(UTC) + timedelta(hours=1)
    db.commit()
    return token


def complete_password_reset(db: Session, *, token: str, new_password: str) -> bool:
    user = db.query(User).filter(User.reset_token == token).first()
    if user is None:
        return False
    if user.reset_token_expires_at is None or user.reset_token_expires_at < datetime.now(UTC):
        return False
    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    return True
CALLOIOTEL_backend__app__services__auth_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/dashboard_service.py" << 'CALLOIOTEL_backend__app__services__dashboard_service_py'
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
CALLOIOTEL_backend__app__services__dashboard_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/email_service.py" << 'CALLOIOTEL_backend__app__services__email_service_py'
import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(*, to_email: str, reset_token: str) -> None:
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
    subject = "Reset your Calliotel password"
    html = f"""
    <p>You requested a password reset for Calliotel.</p>
    <p><a href="{reset_url}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    """

    if not settings.resend_api_key or settings.resend_api_key.startswith("REPLACE_"):
        logger.warning(
            "RESEND_API_KEY not configured; password reset link for %s: %s",
            to_email,
            reset_url,
        )
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )
CALLOIOTEL_backend__app__services__email_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/number_service.py" << 'CALLOIOTEL_backend__app__services__number_service_py'
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
CALLOIOTEL_backend__app__services__number_service_py

mkdir -p "$INSTALL_DIR/backend/app/services"
cat > "$INSTALL_DIR/backend/app/services/setup_service.py" << 'CALLOIOTEL_backend__app__services__setup_service_py'
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
CALLOIOTEL_backend__app__services__setup_service_py

mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/requirements.txt" << 'CALLOIOTEL_backend__requirements_txt'
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sqlalchemy>=2.0.36
alembic>=1.14.0
psycopg[binary]>=3.2.0
pydantic-settings>=2.6.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
bcrypt<4.1
email-validator>=2.2.0
resend>=2.5.0
python-multipart>=0.0.12
CALLOIOTEL_backend__requirements_txt

mkdir -p "$INSTALL_DIR"
cat > "$INSTALL_DIR/docker-compose.yml" << 'CALLOIOTEL_docker_compose_yml'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-calliotel}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:-calliotel_dashboard}
    volumes:
      - dashboard_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-calliotel} -d ${POSTGRES_DB:-calliotel_dashboard}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: ${DATABASE_URL}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  dashboard_pg_data:
CALLOIOTEL_docker_compose_yml

mkdir -p "$INSTALL_DIR/docs"
cat > "$INSTALL_DIR/docs/deployment-caddy.md" << 'CALLOIOTEL_docs__deployment_caddy_md'
# Deploy dashboard on DigitalOcean (165.227.167.89)

Target hostname: **app.calliotel.ai**

## Overview

1. Point DNS `app.calliotel.ai` → droplet IP.
2. Clone repo, configure `calliotel-dashboard/.env` with production URLs and secrets.
3. Run `docker compose up -d --build` in `calliotel-dashboard/`.
4. Install **Caddy** on the host (or a `caddy` container) to reverse-proxy:
   - `app.calliotel.ai` → `localhost:3000` (Next.js)
   - `/api/*` can proxy to `localhost:8000` **or** set `NEXT_PUBLIC_API_URL=https://app.calliotel.ai` and proxy `/api` to the API service.

## Example Caddyfile (host)

```caddy
app.calliotel.ai {
    reverse_proxy /api/* localhost:8000
    reverse_proxy localhost:3000
}
```

## Env (production)

```env
API_PUBLIC_URL=https://app.calliotel.ai
FRONTEND_URL=https://app.calliotel.ai
NEXT_PUBLIC_API_URL=https://app.calliotel.ai
```

Use strong `POSTGRES_PASSWORD`, `JWT_SECRET`, and a verified Resend sender domain for `EMAIL_FROM`.

## Coexistence with voice stack

Voice agent compose lives under `/opt/calliotel/voice-ai-platform`. Dashboard compose is separate under `/opt/calliotel/calliotel-dashboard`. Monitor RAM on 8GB droplets.
CALLOIOTEL_docs__deployment_caddy_md

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/Dockerfile" << 'CALLOIOTEL_frontend__Dockerfile'
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
CALLOIOTEL_frontend__Dockerfile

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/next-env.d.ts" << 'CALLOIOTEL_frontend__next_env_d_ts'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
CALLOIOTEL_frontend__next_env_d_ts

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/next.config.js" << 'CALLOIOTEL_frontend__next_config_js'
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
CALLOIOTEL_frontend__next_config_js

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/package-lock.json" << 'CALLOIOTEL_frontend__package_lock_json'
{
  "name": "calliotel-dashboard-web",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "calliotel-dashboard-web",
      "version": "0.1.0",
      "dependencies": {
        "next": "^15.1.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "@types/node": "^22.10.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "autoprefixer": "^10.4.20",
        "postcss": "^8.4.49",
        "tailwindcss": "^3.4.16",
        "typescript": "^5.7.2"
      }
    },
    "node_modules/@alloc/quick-lru": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/@alloc/quick-lru/-/quick-lru-5.3.0.tgz",
      "integrity": "sha512-U4+70Pc5ZS9osnCBCE5Jha/ciHM+Yp+CNMNC/7HvYbNRk1Ldd+f7qO65W5qfhu/TCv+/ozljlXXe9Nj8419DMA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.11.3",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
      "integrity": "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@img/colour": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@img/sharp-darwin-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.5.tgz",
      "integrity": "sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-darwin-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.5.tgz",
      "integrity": "sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-freebsd-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.5.tgz",
      "integrity": "sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw==",
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "dependencies": {
        "@img/sharp-wasm32": "0.35.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.4.tgz",
      "integrity": "sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.4.tgz",
      "integrity": "sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.3.4.tgz",
      "integrity": "sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw==",
      "cpu": [
        "arm"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.4.tgz",
      "integrity": "sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-ppc64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.3.4.tgz",
      "integrity": "sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ==",
      "cpu": [
        "ppc64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-riscv64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.3.4.tgz",
      "integrity": "sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q==",
      "cpu": [
        "riscv64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-s390x": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.3.4.tgz",
      "integrity": "sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ==",
      "cpu": [
        "s390x"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.3.4.tgz",
      "integrity": "sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.3.4.tgz",
      "integrity": "sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.3.4.tgz",
      "integrity": "sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-linux-arm": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.35.5.tgz",
      "integrity": "sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ==",
      "cpu": [
        "arm"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.35.5.tgz",
      "integrity": "sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-ppc64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.35.5.tgz",
      "integrity": "sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA==",
      "cpu": [
        "ppc64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-ppc64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-riscv64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.35.5.tgz",
      "integrity": "sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ==",
      "cpu": [
        "riscv64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-riscv64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-s390x": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.35.5.tgz",
      "integrity": "sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA==",
      "cpu": [
        "s390x"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-s390x": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.35.5.tgz",
      "integrity": "sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.35.5.tgz",
      "integrity": "sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.35.5.tgz",
      "integrity": "sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.35.5.tgz",
      "integrity": "sha512-Ptsga1su4tQx+LLF1ECS9U6nz5kmrXKo6XVbtR48Ke3ZRxxgaWBu7IDtEe1quo8hiupwm6WFqxVlXaSf7IINGQ==",
      "license": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/runtime": "^1.11.3"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-webcontainers-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-webcontainers-wasm32/-/sharp-webcontainers-wasm32-0.35.5.tgz",
      "integrity": "sha512-hfhF/FmoQyTUkA0bIKFOtw536BQSeBMe6BF6QyWlrPxT754+TFLaZ7sKKTfvvM0yJgKgaYTwnFCIZ/GuDw5SUA==",
      "cpu": [
        "wasm32"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/sharp-wasm32": "0.35.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.35.5.tgz",
      "integrity": "sha512-X4t7g+7ZA5DKblCBEXGjUqqemj4vczING/5viFwAL8h4N3qYeyjwdCvRLHi4EdOUI+2Z7UFlp1VM+p/AuEtm6Q==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-ia32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.35.5.tgz",
      "integrity": "sha512-5Zm82LoBc43nhwNybZlG7Y1KO//Zhsn306fQl29ZOuStHLGTo3BWL83q3cznX0poxSAMuYL1On/BHBxkBeKr6A==",
      "cpu": [
        "ia32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.35.5.tgz",
      "integrity": "sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.6.0.tgz",
      "integrity": "sha512-T7jf+5zgsZHwNJ4lvQ7/aezbyk0nNX+zJVWpmHA7VYsEx7a7qr5Rg5IbtJFqkgze5Y2sruq1RUY8Q837Od7iFw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@next/env": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-15.5.26.tgz",
      "integrity": "sha512-NJBz9q10LU9h3KjHLEbdgWIV+ow/x+MYzKBRfqhm9/QmML3tPMhYmXF/UIV9SDVCNtOqFNc5oX7kZqeiigMCEA==",
      "license": "MIT"
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-15.5.26.tgz",
      "integrity": "sha512-So8eoJxIcXw/TexNUvvh3uY72J9nDo5BpJsAwUKx+FK57CrWXg6RqVufV7U9OT3BO+siMzJ2FuAwBhaHoPlLGg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-15.5.26.tgz",
      "integrity": "sha512-jImzLUTClVWKhP91e5sgDumjxCLhaFSt7DuN5cnRYw99Dppxxhhq5jKRyDa2aTv3JE7dQmTSTsY3EFkSOp9Pog==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-15.5.26.tgz",
      "integrity": "sha512-CaWd+T/Lud2BmZbrsa1CzCnIOdU3YX9Nuk89virZaSB1O+C+8Yrrevgmnl68u4dvZIfOAzQ77S+Njrq7v1XwSA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-15.5.26.tgz",
      "integrity": "sha512-97AyKI34yjpaudlkWHswAf7c1PjWQAC7lLyrw3R5K+bq834EOA+9IG68rIVy0VqrqGjtPSMjJmMmgeJ3wHR5og==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-15.5.26.tgz",
      "integrity": "sha512-eVtuOCew1sBPV7BEgxy7qxuVyqoU3tJIS/xDZwa1/NiQ4Q0LM2JMH7rny+/uVIN6hsQ3PTb0hTQWypA0L2QxtA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-15.5.26.tgz",
      "integrity": "sha512-EiUXADp+Z+OdQnSqbX10YgOSUrs0CXVODoTfySfsP2jdhngn9bq5RJd376FJzqMPe/XX25FMr1aXtYUVPA0qDw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-15.5.26.tgz",
      "integrity": "sha512-HPl41fgkC4kdM5CCIoqNW6KlKEj1N+xS6bjNFFxDNKooUNUu09frgD948zo95TPw/C3XINZpkdkBGNU2RhjEnw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-15.5.26.tgz",
      "integrity": "sha512-TgmJ5ginKr34RPsz01/swpYtFBxh51d66jM26aytpE6NIypU5KtBVI8C2hJjUNpWr7v6sWj8a6+og2MyntcnpA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.15",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.15.tgz",
      "integrity": "sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==",
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.8.0"
      }
    },
    "node_modules/@types/node": {
      "version": "22.20.4",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-22.20.4.tgz",
      "integrity": "sha512-zJRE40jpHtKqE/C4fgHrAKQLJuSpzEnP9ff9Y7YtoR3Wd2pwqzlekDeEuUQXjRd+QCYnVnNwuJYmhdk9XV8gvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/react": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz",
      "integrity": "sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.3.0.tgz",
      "integrity": "sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^19.3.0"
      }
    },
    "node_modules/any-promise": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/any-promise/-/any-promise-1.3.0.tgz",
      "integrity": "sha512-7UvmKalWRt1wgjL1RrGxoSJW/0QZFIegpeGvZG9kjp8vrRu55XTHbwnqq2GpXm9uLbcuhxm3IqX9OB4MZR1b2A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/anymatch": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/anymatch/-/anymatch-3.1.3.tgz",
      "integrity": "sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.4"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/arg": {
      "version": "5.0.2",
      "resolved": "https://registry.npmjs.org/arg/-/arg-5.0.2.tgz",
      "integrity": "sha512-PYjyFOLKQ9y57JvQ6QLo8dAgNqswh8M1RMJYdQduT6xbWSgK36P/Z/v+p888pM69jMMfS8Xd8F6I1kQ/I9HUGg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/autoprefixer": {
      "version": "10.6.1",
      "resolved": "https://registry.npmjs.org/autoprefixer/-/autoprefixer-10.6.1.tgz",
      "integrity": "sha512-cL1Qz6ADZhcEbny/8HPfe99J6HhNoYtpX2LFLIbhgGE7Q1hlQVkYFdetDN7Id3KiQxhDrHwzlHr/YQCnZ8+xSA==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/autoprefixer"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "browserslist": "^4.28.9",
        "caniuse-lite": "^1.0.30001810",
        "fraction.js": "^5.3.4",
        "picocolors": "^1.1.1",
        "postcss-value-parser": "^4.2.0"
      },
      "bin": {
        "autoprefixer": "bin/autoprefixer"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      },
      "peerDependencies": {
        "postcss": "^8.1.0"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.26",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.26.tgz",
      "integrity": "sha512-GLQdD3y6UF8iVuMJl5fHgE4jdn/ua7n+toKfLgNlg3BqQtOZjpy68T8Tup8/wGWZCDlm7KMg7tPb4MPn7oN0TQ==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/binary-extensions": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/binary-extensions/-/binary-extensions-2.3.0.tgz",
      "integrity": "sha512-Ceh+7ox5qe7LJuLHoY0feh3pHuUDHAcRUeyL2VYghZwfpkNIy/+8Ocg0a3UuSoYzavmylwuLWQOf3hl0jjMMIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.29.3",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.3.tgz",
      "integrity": "sha512-1R4kiYKXGViqEN0CnoDrXc1StD9niAwu+j2dukWzrD4bJgsD4lDmEp0CRbc6E/vYJIfTHwPmwyaKtVSudICdPA==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "baseline-browser-mapping": "^2.11.26",
        "caniuse-lite": "^1.0.30001813",
        "electron-to-chromium": "^1.5.439",
        "node-releases": "^2.0.57",
        "update-browserslist-db": "^1.3.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/camelcase-css": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/camelcase-css/-/camelcase-css-2.0.1.tgz",
      "integrity": "sha512-QOSvevhslijgYwRx6Rv7zKdMF8lbRmx+uQGx2+vDc+KI/eBnsy9kit5aj23AgGu3pa4t9AgwbnXWqS+iOY+2aA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001813",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001813.tgz",
      "integrity": "sha512-zfjJo4rM0+fUomGDBW/xcDjhIwz/210DGvip2MAMDZ8KHcRPnOHmEgHPZP0UHlZoxr8fYKVJOqcORhYQcG4FKQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chokidar": {
      "version": "3.6.0",
      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz",
      "integrity": "sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "anymatch": "~3.1.2",
        "braces": "~3.0.2",
        "glob-parent": "~5.1.2",
        "is-binary-path": "~2.1.0",
        "is-glob": "~4.0.1",
        "normalize-path": "~3.0.0",
        "readdirp": "~3.6.0"
      },
      "engines": {
        "node": ">= 8.10.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/chokidar/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/client-only/-/client-only-0.0.1.tgz",
      "integrity": "sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==",
      "license": "MIT"
    },
    "node_modules/commander": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/commander/-/commander-4.1.1.tgz",
      "integrity": "sha512-NOKm8xhkzAjzFx8B2v5OAHT+u5pRQc2UCa2Vq9jYL/31o2wi9mxBA7LIFs3sV5VSC49z6pEhfbMULvShKj26WA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/cssesc": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/cssesc/-/cssesc-3.0.0.tgz",
      "integrity": "sha512-/Tb/JcjK111nNScGob5MNtsntNM1aCNUDipB/TkwZFhyDrrE47SOx/18wF2bbjgc3ZzCSKW1T5nt5EbFoAz/Vg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "cssesc": "bin/cssesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "resolved": "https://registry.npmjs.org/csstype/-/csstype-3.2.3.tgz",
      "integrity": "sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "license": "Apache-2.0",
      "optional": true,
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/didyoumean": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/didyoumean/-/didyoumean-1.2.2.tgz",
      "integrity": "sha512-gxtyfqMg7GKyhQmb056K7M3xszy/myH8w+B4RT+QXBQsvAOdc3XymqDDPHx1BgPgsdAA5SIifona89YtRATDzw==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/dlv": {
      "version": "1.1.3",
      "resolved": "https://registry.npmjs.org/dlv/-/dlv-1.1.3.tgz",
      "integrity": "sha512-+HlytyjlPKnIG8XuRG8WvmBP8xs8P71y+SKKS6ZXWoEgLuePxtDoUEiH7WkdePWrQ5JBpE6aoVqfZfJUQkjXwA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.441",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.441.tgz",
      "integrity": "sha512-b84H5dyxtHtXYbJRJPLvbS+iud4ys2GVZ61BH7/9lJrfCcIL+Sk+Vh2AW6beaErTdstvjZLgEwkE2j0fZlmwRA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz",
      "integrity": "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz",
      "integrity": "sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fastq": {
      "version": "1.20.3",
      "resolved": "https://registry.npmjs.org/fastq/-/fastq-1.20.3.tgz",
      "integrity": "sha512-XKv5nnLs6nLF71NgiKJLIZFLkPyIEuOselLG7ujZnGrRfQK8HpvY+WqKhAJUAdLomwVHErVS4LfxFlPq0/FTAw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/fraction.js": {
      "version": "5.3.4",
      "resolved": "https://registry.npmjs.org/fraction.js/-/fraction.js-5.3.4.tgz",
      "integrity": "sha512-1X1NTtiJphryn/uLQz3whtY6jK3fTqoE3ohKs0tT+Ujr1W59oopxmoEh7Lu5p6vBaPbgoM0bzveAW4Qi5RyWDQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "*"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/rawify"
      }
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.4.tgz",
      "integrity": "sha512-T2UbfbBEF32wiepXIsMlTW9+dDYC6wMh/t/vYA4tuOMKqWz/n3vr1NFSxQiyP+zk2mXsoMA/i/7qV6LKut1t1A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/is-binary-path": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
      "integrity": "sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "binary-extensions": "^2.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.17.0",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.17.0.tgz",
      "integrity": "sha512-J/vG0zBCbIKOQFfufSwyXdMrsohyJIUNkrnmo6WZGzoM7tr/lsbfW5b2BvisL6zsyMzK9UxV9L6c7AoFbyXHOA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/jiti": {
      "version": "1.21.7",
      "resolved": "https://registry.npmjs.org/jiti/-/jiti-1.21.7.tgz",
      "integrity": "sha512-/imKNG4EbWNrVjoNC/1H5/9GFy+tqjGBHCaSsN+P2RnPqjsLmv6UD3Ej+Kj8nBWaRAwyk7kK5ZUc+OEatnTR3A==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jiti": "bin/jiti.js"
      }
    },
    "node_modules/lilconfig": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/lilconfig/-/lilconfig-3.1.3.tgz",
      "integrity": "sha512-/vlFKAoH5Cgt3Ie+JLhRbwOsCQePABiU3tJ1egGvyQ+33R/vcwM2Zl2QR/LzjsBeItPt3oSVXapn+m4nQDvpzw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/antonk52"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/lines-and-columns/-/lines-and-columns-1.2.4.tgz",
      "integrity": "sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/mz": {
      "version": "2.7.0",
      "resolved": "https://registry.npmjs.org/mz/-/mz-2.7.0.tgz",
      "integrity": "sha512-z81GNO7nnYMEhrGh9LeymoE4+Yr0Wn5McHIZMK5cfQCl+NDX08sCZgUc9/6MHni9IWuFLm1Z3HTCXu2z9fN62Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0",
        "object-assign": "^4.0.1",
        "thenify-all": "^1.0.0"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.19",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.19.tgz",
      "integrity": "sha512-Y2tUNy4ouw6tq5oDSKeQYGOyhkUBhNOcGV/02KC+6kd9eDGqdZd++mjMiIDilrBYvjEnCYvVtsuHCuP+okSfug==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/next": {
      "version": "15.5.26",
      "resolved": "https://registry.npmjs.org/next/-/next-15.5.26.tgz",
      "integrity": "sha512-EVCqhvq8Hs+nX9udH2VzE/iXAg9QodZBZnwVJTuAMl386GIYvlJtYhFytV9nSlDYxKw3kEyv8I2dCQs0+on0sQ==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "15.5.26",
        "@swc/helpers": "0.5.15",
        "caniuse-lite": "^1.0.30001579",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.6"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": "^18.18.0 || ^19.8.0 || >= 20.0.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "15.5.26",
        "@next/swc-darwin-x64": "15.5.26",
        "@next/swc-linux-arm64-gnu": "15.5.26",
        "@next/swc-linux-arm64-musl": "15.5.26",
        "@next/swc-linux-x64-gnu": "15.5.26",
        "@next/swc-linux-x64-musl": "15.5.26",
        "@next/swc-win32-arm64-msvc": "15.5.26",
        "@next/swc-win32-x64-msvc": "15.5.26",
        "sharp": "^0.34.3 || ^0.35.4"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.51.1",
        "babel-plugin-react-compiler": "*",
        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "babel-plugin-react-compiler": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/next/node_modules/postcss": {
      "version": "8.4.31",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.31.tgz",
      "integrity": "sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.6",
        "picocolors": "^1.0.0",
        "source-map-js": "^1.0.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.57",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.57.tgz",
      "integrity": "sha512-kQK9LGGFiHtrWiNhZtA7Qbw17AQz+dmsEKODRIVTXA9+e5MS/2gZEBhYJt13GrAz5/IOZKddH/0Z3TP/Zgo+yw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/normalize-path": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/normalize-path/-/normalize-path-3.0.0.tgz",
      "integrity": "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz",
      "integrity": "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-hash": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/object-hash/-/object-hash-3.0.0.tgz",
      "integrity": "sha512-RSn9F68PjH9HqtltsSnqYC1XXoWe9Bju5+213R98cNGttag9q9yAOTzdbsqvIa7aNm5WffBZFpWYr2aWrklWAw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.2",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/pirates/-/pirates-4.0.7.tgz",
      "integrity": "sha512-TfySrs/5nm8fQJDcBDuUng3VOUKsd7S+zqvbOTiGXHfxX4wK31ard+hoNuvkicM/2YFzlpDgABOevKSsB4G/FA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.28",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.18",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/postcss-import": {
      "version": "15.1.0",
      "resolved": "https://registry.npmjs.org/postcss-import/-/postcss-import-15.1.0.tgz",
      "integrity": "sha512-hpr+J05B2FVYUAXHeK1YyI267J/dDDhMU6B6civm8hSY1jYJnBXxzKDKDswzJmtLHryrjhnDjqqp/49t8FALew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "postcss-value-parser": "^4.0.0",
        "read-cache": "^1.0.0",
        "resolve": "^1.1.7"
      },
      "engines": {
        "node": ">=14.0.0"
      },
      "peerDependencies": {
        "postcss": "^8.0.0"
      }
    },
    "node_modules/postcss-js": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/postcss-js/-/postcss-js-4.1.0.tgz",
      "integrity": "sha512-oIAOTqgIo7q2EOwbhb8UalYePMvYoIeRY2YKntdpFQXNosSu3vLrniGgmH9OKs/qAkfoj5oB3le/7mINW1LCfw==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "camelcase-css": "^2.0.1"
      },
      "engines": {
        "node": "^12 || ^14 || >= 16"
      },
      "peerDependencies": {
        "postcss": "^8.4.21"
      }
    },
    "node_modules/postcss-load-config": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/postcss-load-config/-/postcss-load-config-6.0.1.tgz",
      "integrity": "sha512-oPtTM4oerL+UXmx+93ytZVN82RrlY/wPUV8IeDxFrzIjXOLF1pN+EmKPLbubvKHT2HC20xXsCAH2Z+CKV6Oz/g==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "lilconfig": "^3.1.1"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "jiti": ">=1.21.0",
        "postcss": ">=8.0.9",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/postcss-nested": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/postcss-nested/-/postcss-nested-6.2.0.tgz",
      "integrity": "sha512-HQbt28KulC5AJzG+cZtj9kvKB93CFCdLvog1WFLf1D+xmMvPGlBstkpTEZfK5+AN9hfJocyBFCNiqyS48bpgzQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "postcss-selector-parser": "^6.1.1"
      },
      "engines": {
        "node": ">=12.0"
      },
      "peerDependencies": {
        "postcss": "^8.2.14"
      }
    },
    "node_modules/postcss-selector-parser": {
      "version": "6.1.4",
      "resolved": "https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-6.1.4.tgz",
      "integrity": "sha512-bIoJLOmjCO1S9XdY/DcnR5hJxvrDir1PbGChrzXG3vw0/FOliy/fA3dmdhQ441kah4gKv+TwckGzex6wNS5cnQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cssesc": "^3.0.0",
        "util-deprecate": "^1.0.2"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/postcss-value-parser": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/postcss-value-parser/-/postcss-value-parser-4.2.0.tgz",
      "integrity": "sha512-1NNCs6uurfkVbeXG4S8JFT9t19m45ICnif8zWLd5oPSZ50QnwMfK+H3jv408d4jw/7Bttv5axS5IiHoLaVNHeQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/react": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/react/-/react-19.3.0.tgz",
      "integrity": "sha512-E8LUcbtBWt20bbl2YoHfx4ZDBdxVTfOKtCZn9cDSJ4l6/nuoApcpIBcj47t2wZoVX8g2ZHuMHbiShgCR1T5Sog==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.3.0.tgz",
      "integrity": "sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.28.0"
      },
      "peerDependencies": {
        "react": "^19.3.0"
      }
    },
    "node_modules/read-cache": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/read-cache/-/read-cache-1.0.2.tgz",
      "integrity": "sha512-/peqiBB/n07gQGLsWaHho3WfvUyRscw0gYTsEFMhrIe/nWLkYaf5SbKYjGYqtRV3aPwykJgF2VEMo1ac4bnsGA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/readdirp": {
      "version": "3.6.0",
      "resolved": "https://registry.npmjs.org/readdirp/-/readdirp-3.6.0.tgz",
      "integrity": "sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "picomatch": "^2.2.1"
      },
      "engines": {
        "node": ">=8.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.12",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.12.tgz",
      "integrity": "sha512-TyeJ1zif53BPfHootBGwPRYT1RUt6oGWsaQr8UyZW/eAm9bKoijtvruSDEmZHm92CwS9nj7/fWttqPCgzep8CA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz",
      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz",
      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/scheduler": {
      "version": "0.28.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.28.0.tgz",
      "integrity": "sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA1+xKBmHXJsczAw==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.8.5",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.5.tgz",
      "integrity": "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==",
      "license": "ISC",
      "optional": true,
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/sharp": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.35.5.tgz",
      "integrity": "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==",
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/colour": "^1.1.0",
        "detect-libc": "^2.1.2",
        "semver": "^7.8.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-darwin-arm64": "0.35.5",
        "@img/sharp-darwin-x64": "0.35.5",
        "@img/sharp-freebsd-wasm32": "0.35.5",
        "@img/sharp-libvips-darwin-arm64": "1.3.4",
        "@img/sharp-libvips-darwin-x64": "1.3.4",
        "@img/sharp-libvips-linux-arm": "1.3.4",
        "@img/sharp-libvips-linux-arm64": "1.3.4",
        "@img/sharp-libvips-linux-ppc64": "1.3.4",
        "@img/sharp-libvips-linux-riscv64": "1.3.4",
        "@img/sharp-libvips-linux-s390x": "1.3.4",
        "@img/sharp-libvips-linux-x64": "1.3.4",
        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4",
        "@img/sharp-libvips-linuxmusl-x64": "1.3.4",
        "@img/sharp-linux-arm": "0.35.5",
        "@img/sharp-linux-arm64": "0.35.5",
        "@img/sharp-linux-ppc64": "0.35.5",
        "@img/sharp-linux-riscv64": "0.35.5",
        "@img/sharp-linux-s390x": "0.35.5",
        "@img/sharp-linux-x64": "0.35.5",
        "@img/sharp-linuxmusl-arm64": "0.35.5",
        "@img/sharp-linuxmusl-x64": "0.35.5",
        "@img/sharp-webcontainers-wasm32": "0.35.5",
        "@img/sharp-win32-arm64": "0.35.5",
        "@img/sharp-win32-ia32": "0.35.5",
        "@img/sharp-win32-x64": "0.35.5"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        }
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.6",
      "resolved": "https://registry.npmjs.org/styled-jsx/-/styled-jsx-5.1.6.tgz",
      "integrity": "sha512-qSVyDTeMotdvQYoHWLNGwRFJHC+i+ZvdBRYosOFgC+Wg1vx4frN2/RG/NA7SYqqvKNLf39P2LSRA2pu6n0XYZA==",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0 || ^19.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/sucrase": {
      "version": "3.35.1",
      "resolved": "https://registry.npmjs.org/sucrase/-/sucrase-3.35.1.tgz",
      "integrity": "sha512-DhuTmvZWux4H1UOnWMB3sk0sbaCVOoQZjv8u1rDoTV0HTdGem9hkAZtl4JZy8P2z4Bg0nT+YMeOFyVr4zcG5Tw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.2",
        "commander": "^4.0.0",
        "lines-and-columns": "^1.1.6",
        "mz": "^2.7.0",
        "pirates": "^4.0.1",
        "tinyglobby": "^0.2.11",
        "ts-interface-checker": "^0.1.9"
      },
      "bin": {
        "sucrase": "bin/sucrase",
        "sucrase-node": "bin/sucrase-node"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tailwindcss": {
      "version": "3.4.19",
      "resolved": "https://registry.npmjs.org/tailwindcss/-/tailwindcss-3.4.19.tgz",
      "integrity": "sha512-3ofp+LL8E+pK/JuPLPggVAIaEuhvIz4qNcf3nA1Xn2o/7fb7s/TYpHhwGDv1ZU3PkBluUVaF8PyCHcm48cKLWQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@alloc/quick-lru": "^5.2.0",
        "arg": "^5.0.2",
        "chokidar": "^3.6.0",
        "didyoumean": "^1.2.2",
        "dlv": "^1.1.3",
        "fast-glob": "^3.3.2",
        "glob-parent": "^6.0.2",
        "is-glob": "^4.0.3",
        "jiti": "^1.21.7",
        "lilconfig": "^3.1.3",
        "micromatch": "^4.0.8",
        "normalize-path": "^3.0.0",
        "object-hash": "^3.0.0",
        "picocolors": "^1.1.1",
        "postcss": "^8.4.47",
        "postcss-import": "^15.1.0",
        "postcss-js": "^4.0.1",
        "postcss-load-config": "^4.0.2 || ^5.0 || ^6.0",
        "postcss-nested": "^6.2.0",
        "postcss-selector-parser": "^6.1.2",
        "resolve": "^1.22.8",
        "sucrase": "^3.35.0"
      },
      "bin": {
        "tailwind": "lib/cli.js",
        "tailwindcss": "lib/cli.js"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/thenify": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/thenify/-/thenify-3.3.1.tgz",
      "integrity": "sha512-RVZSIV5IG10Hk3enotrhvz0T9em6cyHBLkH/YAZuKqd8hRkKhSfCGIcP2KUY0EPxndzANBmNllzWPwak+bheSw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0"
      }
    },
    "node_modules/thenify-all": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/thenify-all/-/thenify-all-1.6.0.tgz",
      "integrity": "sha512-RNxQH/qI8/t3thXJDwcstUO4zeqo64+Uy/+sNVRBx4Xn2OX+OZ9oP+iJnNFqplFra2ZUVeKCSa2oVWi3T4uVmA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "thenify": ">= 3.1.0 < 4"
      },
      "engines": {
        "node": ">=0.8"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.17.tgz",
      "integrity": "sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyglobby/node_modules/fdir": {
      "version": "6.5.0",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.5.0.tgz",
      "integrity": "sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/tinyglobby/node_modules/picomatch": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz",
      "integrity": "sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-interface-checker": {
      "version": "0.1.13",
      "resolved": "https://registry.npmjs.org/ts-interface-checker/-/ts-interface-checker-0.1.13.tgz",
      "integrity": "sha512-Y/arvbn+rrz3JCKl9C4kVNfTfSm2/mEp5FSz5EsZSANGPSlQrpRI5M4PKF+mJnE52jOO90PnPSc3Ur3bTQw0gA==",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      "integrity": "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz",
      "integrity": "sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/update-browserslist-db": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.3.3.tgz",
      "integrity": "sha512-pJ2sYawQS0R/WI928Gj5GlPhTGzbMelq0+4INtSYNDV9ErKJcX6xjGWkoG/VnB3dpUm00zALaqkrUD77pO5TDQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "dev": true,
      "license": "MIT"
    }
  }
}
CALLOIOTEL_frontend__package_lock_json

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/package.json" << 'CALLOIOTEL_frontend__package_json'
{
  "name": "calliotel-dashboard-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.7.2"
  }
}
CALLOIOTEL_frontend__package_json

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/postcss.config.js" << 'CALLOIOTEL_frontend__postcss_config_js'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
CALLOIOTEL_frontend__postcss_config_js

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/forgot-password"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/forgot-password/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___forgot_password__page_tsx'
"use client";

import { FormEvent, useState } from "react";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const data = await apiPost<{ message: string }>("/api/v1/auth/forgot-password", { email });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot password" subtitle="We will email you a reset link">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/login">Back to login</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___forgot_password__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/layout.tsx" << 'CALLOIOTEL_frontend__src__app___auth___layout_tsx'
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
CALLOIOTEL_frontend__src__app___auth___layout_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/login"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/login/login-form.tsx" << 'CALLOIOTEL_frontend__src__app___auth___login__login_form_tsx'
"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";
import { saveAccessToken } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    registered ? "Account created. Sign in below." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const data = await apiPost<{ access_token: string }>("/api/v1/auth/login", {
        email,
        password,
      });
      saveAccessToken(data.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Log in" subtitle="Manage your Calliotel AI agent">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {info ? <p className="text-sm text-green-700">{info}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </p>
      <p className="mt-2 text-center text-sm text-slate-600">
        New here? <AuthLink href="/signup">Create an account</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___login__login_form_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/login"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/login/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___login__page_tsx'
import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-600">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
CALLOIOTEL_frontend__src__app___auth___login__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/reset-password"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/reset-password/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___reset_password__page_tsx'
import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-600">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
CALLOIOTEL_frontend__src__app___auth___reset_password__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/reset-password"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/reset-password/reset-password-form.tsx" << 'CALLOIOTEL_frontend__src__app___auth___reset_password__reset_password_form_tsx'
"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const data = await apiPost<{ message: string }>("/api/v1/auth/reset-password", {
        token,
        password,
      });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="token">
            Reset token
          </label>
          <input
            id="token"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <AuthLink href="/login">Back to login</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___reset_password__reset_password_form_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(auth)/signup"
cat > "$INSTALL_DIR/frontend/src/app/(auth)/signup/page.tsx" << 'CALLOIOTEL_frontend__src__app___auth___signup__page_tsx'
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { apiPost } from "@/lib/api-client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost<{ access_token: string }>("/api/v1/auth/signup", {
        email,
        password,
      });
      router.push("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start your AI phone agent">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account? <AuthLink href="/login">Log in</AuthLink>
      </p>
    </AuthShell>
  );
}
CALLOIOTEL_frontend__src__app___auth___signup__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/billing"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/billing/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__billing__page_tsx'
import { PlaceholderPage } from "@/components/dashboard-shell";

export default function BillingPage() {
  return <PlaceholderPage title="Billing" message="Billing coming soon" />;
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__billing__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/calls"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/calls/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__calls__page_tsx'
import { PlaceholderPage } from "@/components/dashboard-shell";

export default function CallsPage() {
  return <PlaceholderPage title="Call logs" message="Call logs coming soon" />;
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__calls__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/numbers"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/numbers/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__numbers__page_tsx'
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type ActivationStatus = "inactive" | "pending" | "active";

type PhoneNumberItem = {
  id: string;
  phone_number: string;
  available: boolean;
};

type NumbersPayload = {
  numbers: PhoneNumberItem[];
  activation_status: ActivationStatus;
  assigned_number_id: string | null;
  assigned_phone_number: string | null;
  activated_at: string | null;
};

export default function NumbersPage() {
  const [data, setData] = useState<NumbersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const load = useCallback(() => {
    const token = getAccessToken();
    if (!token) return Promise.resolve();
    return apiGet<NumbersPayload>("/api/v1/dashboard/numbers", token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load numbers"));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onAssign(numberId: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(numberId);
    setError(null);
    try {
      await apiPost("/api/v1/dashboard/numbers/assign", { number_id: numberId }, token);
      await load();
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onActivate() {
    const token = getAccessToken();
    if (!token) return;
    setActivating(true);
    setError(null);
    try {
      await apiPost("/api/v1/dashboard/numbers/activate", {}, token);
      await load();
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading phone numbers…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error ?? "Unable to load numbers"}</p>;
  }

  const locked = data.activation_status === "active";
  const pending = data.activation_status === "pending";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Phone numbers</h1>
      <p className="mt-1 text-sm text-slate-600">
        Pick a number for your AI agent, then activate when you are ready to go live.
      </p>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {locked ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">Agent is live</h2>
          <p className="mt-2 text-sm text-green-800">
            Your number <span className="font-semibold">{data.assigned_phone_number}</span> is
            active. The number cannot be changed after activation.
          </p>
          {data.activated_at ? (
            <p className="mt-2 text-xs text-green-700">
              Activated {new Date(data.activated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {pending && data.assigned_phone_number ? (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Number assigned</h2>
          <p className="mt-2 text-sm text-slate-700">
            Selected: <span className="font-semibold">{data.assigned_phone_number}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            You can pick a different available number below before activating.
          </p>
          <button
            type="button"
            disabled={activating}
            onClick={onActivate}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {activating ? "Activating…" : "Activate Agent"}
          </button>
        </div>
      ) : null}

      {!locked ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Number</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.numbers.map((row) => {
                const isCurrent = row.id === data.assigned_number_id;
                const canAssign = row.available && !isCurrent;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.phone_number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {isCurrent ? (
                        <span className="text-brand-700">Your selection</span>
                      ) : row.available ? (
                        "Available"
                      ) : (
                        "In use"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canAssign ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => onAssign(row.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {busyId === row.id ? "Assigning…" : pending ? "Switch" : "Assign"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__numbers__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__page_tsx'
"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type Summary = {
  agent_status: string;
  phone_number: string | null;
  calls_this_month: number;
  minutes_used: number;
  billing_status: string;
};

function StatusBadge({ value }: { value: string }) {
  const online = value === "online";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        online ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      {value}
    </span>
  );
}

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<Summary>("/api/v1/dashboard/summary", token)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load summary"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-600">Loading dashboard…</p>;
  }

  const cards = [
    {
      title: "Agent status",
      value: <StatusBadge value={summary.agent_status} />,
    },
    {
      title: "Phone number",
      value: summary.phone_number ?? "Not assigned",
    },
    {
      title: "Calls this month",
      value: String(summary.calls_this_month),
    },
    {
      title: "Minutes used",
      value: String(summary.minutes_used),
    },
    {
      title: "Billing",
      value: summary.billing_status.replace("_", " "),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Overview of your AI phone agent</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <div className="mt-2 text-lg font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/setup"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/dashboard/setup/page.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___dashboard__setup__page_tsx'
"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type DayHours = { open: string; close: string; closed: boolean };

type SetupData = {
  business_name: string | null;
  business_type: string | null;
  business_hours: Record<string, DayHours>;
  business_services: string | null;
  business_faq: string | null;
  preferred_language: "en" | "ar";
  agent_voice: "female" | "male";
};

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "salon", label: "Salon" },
  { value: "clinic", label: "Clinic" },
  { value: "real_estate", label: "Real estate" },
  { value: "other", label: "Other" },
];

const emptySetup = (): SetupData => ({
  business_name: "",
  business_type: null,
  business_hours: Object.fromEntries(
    DAYS.map((d) => [d.key, { open: "09:00", close: "17:00", closed: false }]),
  ),
  business_services: "",
  business_faq: "",
  preferred_language: "en",
  agent_voice: "female",
});

export default function SetupPage() {
  const [form, setForm] = useState<SetupData>(emptySetup());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<SetupData>("/api/v1/dashboard/setup", token)
      .then((data) => {
        setForm({
          ...data,
          business_name: data.business_name ?? "",
          business_services: data.business_services ?? "",
          business_faq: data.business_faq ?? "",
          business_hours: data.business_hours ?? emptySetup().business_hours,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      await apiPut(
        "/api/v1/dashboard/setup",
        {
          ...form,
          business_name: form.business_name?.trim() || null,
          business_services: form.business_services || null,
          business_faq: form.business_faq || null,
        },
        token,
      );
      setToast("Business setup saved.");
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateDay(key: string, patch: Partial<DayHours>) {
    setForm((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [key]: { ...prev.business_hours[key], ...patch },
      },
    }));
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading setup…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Business setup</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tell your AI agent about your business. This name appears in your dashboard header.
      </p>

      {toast ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_name">
            Business name
          </label>
          <input
            id="business_name"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_name ?? ""}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_type">
            Business type
          </label>
          <select
            id="business_type"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_type ?? ""}
            onChange={(e) =>
              setForm({ ...form, business_type: e.target.value || null })
            }
          >
            <option value="">Select type…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Hours of operation</legend>
          <div className="mt-3 space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = form.business_hours[key];
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="w-24 text-sm font-medium text-slate-700">{label}</span>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={day.closed}
                      onChange={(e) => updateDay(key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="services">
            Services / menu
          </label>
          <textarea
            id="services"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_services ?? ""}
            onChange={(e) => setForm({ ...form, business_services: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="faq">
            FAQ
          </label>
          <textarea
            id="faq"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_faq ?? ""}
            onChange={(e) => setForm({ ...form, business_faq: e.target.value })}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Preferred language</legend>
          <div className="mt-2 flex gap-4">
            {[
              { value: "en", label: "English" },
              { value: "ar", label: "Arabic" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferred_language"
                  checked={form.preferred_language === opt.value}
                  onChange={() =>
                    setForm({ ...form, preferred_language: opt.value as "en" | "ar" })
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Agent voice</legend>
          <div className="mt-2 flex gap-4">
            {[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="agent_voice"
                  checked={form.agent_voice === opt.value}
                  onChange={() =>
                    setForm({ ...form, agent_voice: opt.value as "female" | "male" })
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
CALLOIOTEL_frontend__src__app___dashboard___dashboard__setup__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app/(dashboard)"
cat > "$INSTALL_DIR/frontend/src/app/(dashboard)/layout.tsx" << 'CALLOIOTEL_frontend__src__app___dashboard___layout_tsx'
"use client";

import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
CALLOIOTEL_frontend__src__app___dashboard___layout_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app"
cat > "$INSTALL_DIR/frontend/src/app/globals.css" << 'CALLOIOTEL_frontend__src__app__globals_css'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}
CALLOIOTEL_frontend__src__app__globals_css

mkdir -p "$INSTALL_DIR/frontend/src/app"
cat > "$INSTALL_DIR/frontend/src/app/layout.tsx" << 'CALLOIOTEL_frontend__src__app__layout_tsx'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calliotel",
  description: "AI phone agents for your business",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
CALLOIOTEL_frontend__src__app__layout_tsx

mkdir -p "$INSTALL_DIR/frontend/src/app"
cat > "$INSTALL_DIR/frontend/src/app/page.tsx" << 'CALLOIOTEL_frontend__src__app__page_tsx'
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
CALLOIOTEL_frontend__src__app__page_tsx

mkdir -p "$INSTALL_DIR/frontend/src/components"
cat > "$INSTALL_DIR/frontend/src/components/auth-shell.tsx" << 'CALLOIOTEL_frontend__src__components__auth_shell_tsx'
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Calliotel</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-brand-600 hover:text-brand-700">
      {children}
    </Link>
  );
}
CALLOIOTEL_frontend__src__components__auth_shell_tsx

mkdir -p "$INSTALL_DIR/frontend/src/components"
cat > "$INSTALL_DIR/frontend/src/components/dashboard-shell.tsx" << 'CALLOIOTEL_frontend__src__components__dashboard_shell_tsx'
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { clearAccessToken, getAccessToken, logout } from "@/lib/auth";

type MeResponse = { email: string; tenant_name: string };

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/setup", label: "Setup" },
  { href: "/dashboard/numbers", label: "Numbers" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/billing", label: "Billing" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    function loadMe() {
      const t = getAccessToken();
      if (!t) return;
      apiGet<MeResponse>("/api/v1/auth/me", t)
        .then(setMe)
        .catch(() => {
          clearAccessToken();
          router.replace("/login");
        })
        .finally(() => setReady(true));
    }
    loadMe();
    const onTenantUpdated = () => loadMe();
    window.addEventListener("calliotel:tenant-updated", onTenantUpdated);
    return () => window.removeEventListener("calliotel:tenant-updated", onTenantUpdated);
  }, [router]);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-4 py-5">
          <p className="text-sm font-semibold text-brand-600">Calliotel</p>
          <p className="mt-1 truncate text-xs text-slate-500">{me?.tenant_name}</p>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden">
            <p className="text-sm font-semibold text-brand-600">Calliotel</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-slate-900">{me?.email}</p>
            <p className="hidden text-xs text-slate-500 sm:block">{me?.tenant_name}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ml-4 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                pathname === item.href ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PlaceholderPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </div>
  );
}
CALLOIOTEL_frontend__src__components__dashboard_shell_tsx

mkdir -p "$INSTALL_DIR/frontend/src/lib"
cat > "$INSTALL_DIR/frontend/src/lib/api-client.ts" << 'CALLOIOTEL_frontend__src__lib__api_client_ts'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((d: { msg?: string }) => d.msg).join(", ");
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

export { API_URL };
CALLOIOTEL_frontend__src__lib__api_client_ts

mkdir -p "$INSTALL_DIR/frontend/src/lib"
cat > "$INSTALL_DIR/frontend/src/lib/auth.ts" << 'CALLOIOTEL_frontend__src__lib__auth_ts'
const TOKEN_KEY = "calliotel_access_token";

export function saveAccessToken(token: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

export function logout(): void {
  clearAccessToken();
}
CALLOIOTEL_frontend__src__lib__auth_ts

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/tailwind.config.js" << 'CALLOIOTEL_frontend__tailwind_config_js'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
    },
  },
  plugins: [],
};
CALLOIOTEL_frontend__tailwind_config_js

mkdir -p "$INSTALL_DIR/frontend"
cat > "$INSTALL_DIR/frontend/tsconfig.json" << 'CALLOIOTEL_frontend__tsconfig_json'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
CALLOIOTEL_frontend__tsconfig_json

echo
echo "Created $INSTALL_DIR with 66 project files."
echo
echo "Next steps:"
echo "  cd \"$INSTALL_DIR\""
echo "  cp .env.example .env"
echo "  # Edit .env — replace every REPLACE_* value"
echo "  docker compose up -d --build"
echo
echo "Open http://localhost:3000 (web) and http://localhost:8000/health (api)"
CALLOIOTEL_scripts__bootstrap_calliotel_dashboard_sh

chmod +x "$INSTALL_DIR/scripts/bootstrap-calliotel-dashboard.sh" 2>/dev/null || true

echo "Created $INSTALL_DIR with 66 project files."
echo "  cd \"$INSTALL_DIR\" && cp .env.example .env && docker compose up -d --build"
