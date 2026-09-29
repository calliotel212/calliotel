from __future__ import annotations

from livekit.agents import stt, tts
from livekit.plugins import deepgram, openai

from plugins.stt.faster_whisper_stt import FasterWhisperSTT
from plugins.tts.piper_tts import PiperTTS
from utils.config import Settings, resolve_llm_provider

GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1"


def build_llm(settings: Settings) -> openai.LLM:
    provider = resolve_llm_provider(settings)
    if provider == "groq":
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is required when LLM_PROVIDER=groq")
        return openai.LLM(
            api_key=settings.groq_api_key,
            base_url=GROQ_OPENAI_BASE_URL,
            model=settings.groq_model,
            max_completion_tokens=256,
        )
    return openai.LLM.with_ollama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
    )


def build_vad(settings: Settings):
    if not settings.use_silero_vad:
        return None
    from livekit.plugins import silero

    return silero.VAD.load()


def build_stt(settings: Settings) -> stt.STT:
    if settings.deepgram_api_key:
        return deepgram.STT(
            api_key=settings.deepgram_api_key,
            model=settings.deepgram_stt_model,
            language="en-US",
            vad_events=True,
            endpointing_ms=300,
        )
    return FasterWhisperSTT(
        model=settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
        vad_filter=settings.whisper_vad_filter,
    )


def build_tts(settings: Settings) -> tts.TTS:
    provider = settings.tts_provider
    if provider == "deepgram":
        if not settings.deepgram_api_key:
            raise ValueError(
                "DEEPGRAM_API_KEY is required when TTS_PROVIDER=deepgram"
            )
        return deepgram.TTS(
            api_key=settings.deepgram_api_key,
            model=settings.deepgram_tts_model,
        )
    if provider == "cartesia":
        from livekit.plugins import cartesia

        kwargs: dict = {"api_key": settings.cartesia_api_key or None}
        if settings.cartesia_voice:
            kwargs["voice"] = settings.cartesia_voice
        return cartesia.TTS(**kwargs)
    if provider == "coqui":
        from plugins.tts.coqui_tts import CoquiTTS

        return CoquiTTS(model_name=settings.coqui_model)
    if provider == "piper":
        return PiperTTS(
            voice=settings.piper_voice,
            data_dir=settings.piper_data_dir,
        )
    raise ValueError(
        f"Unknown TTS_PROVIDER={provider!r}. "
        "Use deepgram, cartesia, piper, or coqui."
    )


def uses_cloud_stt(settings: Settings) -> bool:
    return bool(settings.deepgram_api_key)


def uses_cloud_tts(settings: Settings) -> bool:
    return settings.tts_provider in ("deepgram", "cartesia")
