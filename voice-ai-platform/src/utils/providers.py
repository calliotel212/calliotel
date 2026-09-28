from __future__ import annotations

import os

from livekit.agents import stt, tts
from livekit.plugins import deepgram, openai, silero

from plugins.stt.faster_whisper_stt import FasterWhisperSTT
from plugins.tts.piper_tts import PiperTTS
from utils.config import Settings


def build_llm(settings: Settings) -> openai.LLM:
    return openai.LLM.with_ollama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
    )


def build_vad() -> silero.VAD:
    return silero.VAD.load()


def build_stt(settings: Settings) -> stt.STT:
    if settings.deepgram_api_key:
        return deepgram.STT(model="nova-3", language="en-US")
    return FasterWhisperSTT(
        model=settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
        vad_filter=settings.whisper_vad_filter,
    )


def build_tts(settings: Settings) -> tts.TTS:
    provider = settings.tts_provider
    if provider == "coqui":
        from plugins.tts.coqui_tts import CoquiTTS

        return CoquiTTS(model_name=settings.coqui_model)
    if provider == "piper":
        return PiperTTS(
            voice=settings.piper_voice,
            data_dir=settings.piper_data_dir,
        )
    raise ValueError(
        f"Unknown TTS_PROVIDER={provider!r}. Use 'piper' or 'coqui' (Coqui needs Python 3.11)."
    )


def apply_livekit_env(settings: Settings) -> None:
    os.environ.setdefault("LIVEKIT_URL", settings.livekit_url)
    os.environ.setdefault("LIVEKIT_API_KEY", settings.livekit_api_key)
    os.environ.setdefault("LIVEKIT_API_SECRET", settings.livekit_api_secret)
