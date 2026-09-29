# calliotel.ai Voice AI Platform

Self-hosted voice AI for inbound and outbound phone calls, built on [LiveKit Agents](https://docs.livekit.io/agents/).

## Status

- **Phase 1 (MVP):** Local agent demo — Ollama LLM, STT, self-hosted TTS, then LiveKit + telephony.
- **Research:** See the Project Context doc [voice-ai-research](/cursor/stores/self/docs/voice-ai-research.md) for framework comparison, architecture, and roadmap.

## Repository layout

```
voice-ai-platform/
├── docs/                 # Architecture, deployment, API reference
├── infra/                # Terraform, Kubernetes, Ansible
├── src/
│   ├── agents/           # Voice agent implementations
│   ├── api/              # REST/WebSocket control plane
│   ├── orchestration/    # Dispatch, workers, sessions
│   ├── telephony/        # SIP, LiveKit bridge, routing
│   ├── plugins/          # STT, LLM, TTS provider adapters
│   ├── tools/            # Agent function-calling tools
│   ├── storage/          # Postgres, Redis, object store clients
│   ├── observability/    # Metrics, tracing, logging
│   └── utils/            # Config, latency, audio helpers
├── dashboard/            # Web UI (later phases)
├── tests/
├── scripts/
├── config/
├── examples/             # Runnable demos (Phase 1 starts here)
└── migrations/
```

## Phase 1 goals

1. Python environment + LiveKit Agents SDK
2. Minimal local demo: Ollama (`huihui_ai/qwen3-abliterated:8b`), Deepgram or Whisper STT, self-hosted TTS (e.g. Coqui)
3. LiveKit server + SIP (Twilio/Telnyx) for real phone calls
4. Basic latency metrics

## Prerequisites (local demo)

- Python 3.11+
- [Ollama](https://ollama.com/) running at `http://localhost:11434` with model `huihui_ai/qwen3-abliterated:8b`
- Optional: Deepgram API key, or local Whisper; Coqui TTS or compatible stack

## Quick start (Phase 1 local demo)

See [getting-started.md](docs/getting-started.md) for full steps.

```bash
cd voice-ai-platform
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Ollama: ollama pull huihui_ai/qwen3-abliterated:8b && ollama serve
python examples/local_voice_demo.py console
```

## Deploy to DigitalOcean

Production runs the LiveKit **agent worker** in Docker on a single Ubuntu droplet, with co-located **Ollama** (LLM), **Redis** (session state for platform services), and **Piper** TTS on the worker container. LiveKit itself is **LiveKit Cloud** or your own LiveKit server — only the worker connects outbound to `LIVEKIT_URL` (typically `wss://...`).

### Architecture

```text
                    ┌─────────────────┐
  Phone / WebRTC ──►│ LiveKit Cloud   │
                    │ (or self-host)  │
                    └────────┬────────┘
                             │ wss (outbound from droplet)
                    ┌────────▼────────┐
                    │  agent worker   │──► Deepgram (optional STT)
                    │  (this repo)    │──► faster-whisper (local STT)
                    └─┬───────┬───────┘
                      │       │
              ┌───────▼──┐ ┌──▼───────┐
              │  Ollama  │ │  Redis   │
              │  :11434  │ │  :6379   │
              └──────────┘ └──────────┘
```

### Prerequisites

- DigitalOcean droplet (Ubuntu 22.04+); see `scripts/digitalocean/bootstrap.sh` and Project handoff for sizing.
- LiveKit project URL and API key/secret ([LiveKit Cloud](https://cloud.livekit.io/) or self-hosted).
- Optional: [Deepgram](https://deepgram.com/) API key (recommended in production to avoid running Whisper on the same box as Ollama).

### Steps

1. Create a droplet and SSH in as root (or a sudo user).
2. Run the bootstrap script (clone + Docker + Compose):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/calliotel212/calliotel/main/voice-ai-platform/scripts/digitalocean/bootstrap.sh -o /tmp/bootstrap.sh
   chmod +x /tmp/bootstrap.sh
   sudo REPO_URL=https://github.com/calliotel212/calliotel.git BRANCH=main /tmp/bootstrap.sh
   ```

   Or clone the repo and run `sudo bash voice-ai-platform/scripts/digitalocean/bootstrap.sh` from your checkout.

3. Edit `/opt/calliotel/voice-ai-platform/.env`: set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and optional `DEEPGRAM_API_KEY`.
4. Restart: `cd /opt/calliotel/voice-ai-platform && docker compose up -d --build`.
5. Confirm the worker registered in the LiveKit project dashboard and check logs: `docker compose logs -f agent`.

Ollama pulls `OLLAMA_MODEL` (default `huihui_ai/qwen3-abliterated:4b`) on first start via `scripts/digitalocean/ollama-entrypoint.sh`. Piper voice assets download on first TTS use into the `piper_data` volume.

Production worker entrypoint: `src/agents/worker.py` (started by `python -m livekit.agents start`, not console mode). Agent name: `livekit.toml` → `[agent] name`.

## License

Apache 2.0 (planned)
