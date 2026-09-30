# Deploy landing on DigitalOcean (165.227.167.89)

Target hostnames: **calliotel.ai** and **www.calliotel.ai**

## Overview

1. Point DNS `calliotel.ai` and `www.calliotel.ai` → droplet IP.
2. Clone repo, copy `calliotel-landing/.env.example` → `.env`, fill LiveKit secrets.
3. Run `docker compose up -d --build` in `calliotel-landing/` (listens on host **3001**).
4. Extend the host **Caddyfile** with the marketing site block below. Keep the existing **app** block unchanged.

## Example Caddyfile (host)

```caddy
calliotel.ai, www.calliotel.ai {
    reverse_proxy localhost:3001
}

app.calliotel.ai {
    reverse_proxy /api/* localhost:8000
    reverse_proxy localhost:3000
}
```

Reload Caddy after editing: `sudo systemctl reload caddy` (or `caddy reload --config /etc/caddy/Caddyfile`).

## Env (production)

Use the same LiveKit project as the voice worker (`voice-ai-platform`). Example:

```env
LIVEKIT_URL=wss://calliotel-ai-6kc97c5t.livekit.cloud
LIVEKIT_API_KEY=<from LiveKit Cloud>
LIVEKIT_API_SECRET=<from LiveKit Cloud>
LIVEKIT_AGENT_NAME=calliotel-voice-assistant
DEMO_MAX_SECONDS=300
```

Ensure the agent worker is running and registered under `LIVEKIT_AGENT_NAME` so token dispatches join each ephemeral `demo-*` room.

## Coexistence

- Marketing landing: `/opt/calliotel/calliotel-landing` → port **3001**
- Dashboard: `calliotel-dashboard` → port **3000** (+ API **8000**)
- Voice stack: `/opt/calliotel/voice-ai-platform`

Monitor RAM on 8GB droplets when all stacks run together.
