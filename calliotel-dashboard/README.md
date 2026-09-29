# Calliotel client dashboard (Phase 1 — auth)

Customer-facing app for **app.calliotel.ai**: signup, login, forgot/reset password.

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

Migrations run automatically when the `api` container starts (`alembic upgrade head`).

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

Forgot password (logs reset URL if `RESEND_API_KEY` is still a placeholder — check `docker compose logs api`):

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}' | jq
```

## Production (DigitalOcean)

See [docs/deployment-caddy.md](docs/deployment-caddy.md) for `app.calliotel.ai` on the same droplet as the voice agent (Caddy TLS stub).

## Phase 1 scope

**Done:** auth API + auth pages + Compose + Postgres  
**TODO (Phase 2+):** dashboard home, business setup, phone picker, call logs, Stripe billing, Caddy deploy automation
