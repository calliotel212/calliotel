# Calliotel Landing

Marketing site for Calliotel — AI phone agents for MENA businesses.

## Local development

```bash
cd calliotel-landing
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker (production standalone)

From this directory:

```bash
docker compose up --build
```

Open [http://localhost:3001](http://localhost:3001) (host port **3001** maps to container **3000**).

On a droplet or VPS, clone the repo, `cd calliotel-landing`, then run the same `docker compose up --build -d` and expose port 3001 in your firewall or reverse proxy.

## Pass 2

LiveKit voice demo and token API will be added in a follow-up pass. See `.env.example` for future variables.
