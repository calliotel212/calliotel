from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str
    ollama_model: str
    deepgram_api_key: str
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    whisper_vad_filter: bool
    tts_provider: str
    coqui_model: str
    piper_voice: str
    piper_data_dir: str
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str


def get_settings() -> Settings:
    return Settings(
        ollama_base_url=_env("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        ollama_model=_env("OLLAMA_MODEL", "huihui_ai/qwen3-abliterated:8b"),
        deepgram_api_key=_env("DEEPGRAM_API_KEY"),
        whisper_model=_env("WHISPER_MODEL", "base.en"),
        whisper_device=_env("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=_env("WHISPER_COMPUTE_TYPE", "int8"),
        whisper_vad_filter=_env_bool("WHISPER_VAD_FILTER", False),
        tts_provider=_env("TTS_PROVIDER", "piper").lower(),
        coqui_model=_env(
            "COQUI_MODEL", "tts_models/en/ljspeech/tacotron2-DDC"
        ),
        piper_voice=_env("PIPER_VOICE", "en_US-lessac-medium"),
        piper_data_dir=_env("PIPER_DATA_DIR", "data/piper"),
        livekit_url=_env("LIVEKIT_URL", "ws://127.0.0.1:7880"),
        livekit_api_key=_env("LIVEKIT_API_KEY", "devkey"),
        livekit_api_secret=_env("LIVEKIT_API_SECRET", "secret"),
    )
