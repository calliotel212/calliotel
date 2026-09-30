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
