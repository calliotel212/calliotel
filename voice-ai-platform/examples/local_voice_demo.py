#!/usr/bin/env python3
"""
Local LiveKit voice demo: Groq/Ollama LLM + Deepgram or Whisper STT + cloud or Piper TTS.

Uses the same worker as production (see src/agents/worker.py). For cloud mode, copy
.env.cloud.example to .env. For local dev with Ollama on localhost:11434:

  cd voice-ai-platform
  source .venv/bin/activate
  pip install -e .
  cp .env.example .env   # edit as needed
  python examples/local_voice_demo.py console

Console mode uses your microphone and speakers (no LiveKit server required for basic testing).
Use `dev` when a LiveKit server is running and you want room-based testing.
"""

from __future__ import annotations

from livekit import agents

from agents.worker import server

if __name__ == "__main__":
    agents.cli.run_app(server)
