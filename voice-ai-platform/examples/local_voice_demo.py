#!/usr/bin/env python3
"""
Local LiveKit voice demo: Ollama LLM + Deepgram or Whisper STT + Piper/Coqui TTS.

Run on your machine (where Ollama listens on localhost:11434):

  cd voice-ai-platform
  source .venv/bin/activate
  cp .env.example .env   # edit as needed
  python examples/local_voice_demo.py console

Console mode uses your microphone and speakers (no LiveKit server required for basic testing).
Use `dev` when a LiveKit server is running and you want room-based testing.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, JobContext, stt

from agents.local_assistant import build_local_assistant
from utils.config import get_settings
from utils.providers import (
    apply_livekit_env,
    build_llm,
    build_stt,
    build_tts,
    build_vad,
)

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local")

settings = get_settings()
apply_livekit_env(settings)

server = agents.AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    vad = build_vad()
    stt_engine = build_stt(settings)
    if not stt_engine.capabilities.streaming:
        stt_engine = stt.StreamAdapter(stt=stt_engine, vad=vad)

    session = AgentSession(
        vad=vad,
        stt=stt_engine,
        llm=build_llm(settings),
        tts=build_tts(settings),
    )

    assistant = build_local_assistant()
    await session.start(room=ctx.room, agent=assistant)
    await session.generate_reply(
        instructions="Greet the user briefly and ask how you can help."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
