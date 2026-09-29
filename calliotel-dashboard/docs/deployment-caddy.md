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
