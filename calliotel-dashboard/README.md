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

Set `ADMIN_*` environment variables in production for the owner console at `/admin` (not linked from marketing pages).

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

## Advertiser dashboard (AdsFind)

Separate auth from the tenant dashboard. JWT type `advertiser`, stored in sessionStorage as `advertiser_access_token`.

| URL | Purpose |
|-----|---------|
| http://localhost:3000/advertise | Sign up / log in for advertisers |
| http://localhost:3000/advertiser/dashboard | Wallet + campaigns (requires advertiser token) |

Test flow:

```bash
ADV_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/advertisers/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ads@example.com","password":"testpass123","business_name":"Demo Ads Co"}' \
  | jq -r .access_token)

curl -s http://localhost:8000/api/v1/advertisers/me -H "Authorization: Bearer $ADV_TOKEN" | jq

curl -s -X POST http://localhost:8000/api/v1/advertisers/wallet/deposit \
  -H "Authorization: Bearer $ADV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount_usd":100}' | jq

curl -s -X POST http://localhost:8000/api/v1/advertisers/campaigns \
  -H "Authorization: Bearer $ADV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"brand_name":"Demo","ad_copy":"We fix leaks fast.","destination_url":"https://example.com","intent_description":"emergency plumber","max_cpc":2.5,"daily_budget":50,"target_countries":["AE"],"target_languages":["en"]}' | jq

# Internal match (optional geo filters — empty campaign target arrays = worldwide)
curl -s 'http://localhost:8000/api/v1/internal/ads/match?q=airport+car+rental&country=AE&language=en' | jq
```

Campaign `target_countries` / `target_languages` use ISO-style codes; empty lists mean no restriction on that dimension. The match API applies the same rule when `country` / `language` query params are set.

Tenant routes under `/dashboard` are unchanged.

## Scope

**Done:** Phase 1 auth, Phase 2 dashboard home, Phase 3 business setup, Phase 4 phone picker + activate, AdsFind advertiser accounts  
**TODO:** Call logs, Stripe billing, real wallet payments
