"""Production LiveKit agent worker (cloud or local LLM + STT + TTS).

Started via: python -m livekit.agents start src/agents/worker.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, JobContext, stt

from agents.local_assistant import build_local_assistant
from utils.config import apply_provider_env, get_settings
from utils.providers import (
    build_llm,
    build_stt,
    build_tts,
    build_vad,
    uses_cloud_stt,
    uses_cloud_tts,
)

_project_root = Path(__file__).resolve().parents[2]
load_dotenv(_project_root / ".env")
load_dotenv(_project_root / ".env.local")
load_dotenv()

settings = get_settings()
apply_provider_env(settings)

server = agents.AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    vad = build_vad(settings)
    stt_engine = build_stt(settings)
    tts_engine = build_tts(settings)

    if not uses_cloud_stt(settings) and hasattr(stt_engine, "prewarm"):
        await asyncio.to_thread(stt_engine.prewarm)
    if not uses_cloud_tts(settings) and hasattr(tts_engine, "prewarm"):
        await asyncio.to_thread(tts_engine.prewarm)

    if not stt_engine.capabilities.streaming and vad is not None:
        stt_engine = stt.StreamAdapter(stt=stt_engine, vad=vad)

    session = AgentSession(
        vad=vad,
        stt=stt_engine,
        llm=build_llm(settings),
        tts=tts_engine,
    )

    assistant = build_local_assistant()
    await session.start(room=ctx.room, agent=assistant)
    # No opening generate_reply — system prompt requires waiting for the caller's first words.
