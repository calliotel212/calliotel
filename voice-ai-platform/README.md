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

## License

Apache 2.0 (planned)
