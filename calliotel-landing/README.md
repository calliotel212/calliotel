# Calliotel Landing

Marketing site for Calliotel — AI phone agents for MENA businesses.

**Pass 2** adds a browser LiveKit voice demo: token API, agent dispatch, and WebRTC client on the homepage.

## Local development

```bash
cd calliotel-landing
cp .env.example .env
# Edit .env with LiveKit Cloud (or self-hosted) credentials
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), scroll to **Try the voice demo**, and click **Start voice call**.

Without LiveKit env vars, `POST /api/livekit/token` returns **503** with a clear message; the UI shows that error.

## Environment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LIVEKIT_URL` | yes | — | WebSocket URL, e.g. `wss://calliotel-ai-6kc97c5t.livekit.cloud` |
| `LIVEKIT_API_KEY` | yes | — | LiveKit API key |
| `LIVEKIT_API_SECRET` | yes | — | LiveKit API secret (server only) |
| `LIVEKIT_AGENT_NAME` | no | `calliotel-voice-assistant` | Agent dispatched into each demo room |
| `DEMO_MAX_SECONDS` | no | `300` | Client countdown; token TTL is slightly longer |

The voice worker in `voice-ai-platform` must use the same agent name (`livekit.toml`).

## Docker (production standalone)

From this directory:

```bash
cp .env.example .env
# fill secrets
docker compose up --build -d
```

Open [http://localhost:3001](http://localhost:3001) (host port **3001** maps to container **3000**).

Compose loads `.env` via `env_file` and passes LiveKit variables into the `landing` service.

## Pass 2 deploy (droplet)

1. `git pull` on the droplet in the monorepo root.
2. `cd calliotel-landing && cp .env.example .env` — set production LiveKit values.
3. `docker compose up -d --build`
4. Caddy: add `calliotel.ai` / `www` → `localhost:3001` (see [docs/deployment-caddy.md](./docs/deployment-caddy.md)).
5. Confirm voice worker is up: `docker compose ps` in `voice-ai-platform/`.

## Demo test checklist

1. Homepage loads; demo section shows **Start voice call** (not disabled).
2. Click start — browser prompts for microphone; status moves to connected.
3. Speak — agent audio plays back (worker joined via dispatch).
4. **End call** or wait for timer — session ends cleanly.
5. With empty LiveKit env, start returns a readable configuration error.

## API

`POST /api/livekit/token` — no body. Response:

```json
{
  "serverUrl": "wss://…",
  "token": "…",
  "roomName": "demo-…",
  "maxSeconds": 300
}
```

Rate-limited in-memory by client IP (8 requests / minute per IP).
