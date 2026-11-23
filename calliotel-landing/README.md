# AdsFind Landing (calliotel.ai)

Enterprise marketing site for **AdsFind by Calliotel** — the AI advertising network. The homepage highlights advertiser and publisher flows; the legacy **voice agent** LiveKit demo lives at `/demo`.

## Local development

```bash
cd calliotel-landing
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Voice demo: [http://localhost:3000/demo](http://localhost:3000/demo).

## App links (`NEXT_PUBLIC_APP_URL`)

CTAs (Advertise, Publishers, Log in) point at the **app dashboard**, not this marketing host. Set the base URL so production works when:

- Marketing: `calliotel.ai` → port **3001** (Docker)
- App: `app.calliotel.ai` → port **3000**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | no | `https://app.calliotel.ai` | Base URL for `/login`, `/advertise`, `/publishers` |
| `LIVEKIT_URL` | for `/demo` | — | WebSocket URL for voice demo |
| `LIVEKIT_API_KEY` | for `/demo` | — | LiveKit API key |
| `LIVEKIT_API_SECRET` | for `/demo` | — | LiveKit API secret (server only) |
| `LIVEKIT_AGENT_NAME` | no | `calliotel-voice-assistant` | Agent dispatched into each demo room |
| `DEMO_MAX_SECONDS` | no | `300` | Client countdown; token TTL is slightly longer |

Local dashboard example:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Docker (production standalone)

```bash
cp .env.example .env
docker compose up --build -d
```

Open [http://localhost:3001](http://localhost:3001).

## Routes

| Route | Purpose |
|-------|---------|
| `/` | AdsFind enterprise homepage |
| `/demo` | Calliotel LiveKit voice demo (Pass 2) |

See [docs/deployment-caddy.md](./docs/deployment-caddy.md) for apex routing on the droplet.