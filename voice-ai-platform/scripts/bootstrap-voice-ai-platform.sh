#!/usr/bin/env bash
# Bootstrap calliotel.ai voice-ai-platform on macOS/Linux
# Usage: bash bootstrap-voice-ai-platform.sh [target-dir]
set -euo pipefail

ROOT="${1:-voice-ai-platform}"
echo "Creating project in $(pwd)/${ROOT}"
mkdir -p "${ROOT}"
cd "${ROOT}"

# --- directories ---
mkdir -p "docs"
mkdir -p "infra/terraform/aws"
mkdir -p "infra/terraform/gcp"
mkdir -p "infra/terraform/modules"
mkdir -p "infra/kubernetes/agents"
mkdir -p "infra/kubernetes/livekit"
mkdir -p "infra/kubernetes/monitoring"
mkdir -p "infra/ansible"
mkdir -p "src/agents"
mkdir -p "src/api/routes"
mkdir -p "src/api/middleware"
mkdir -p "src/orchestration"
mkdir -p "src/telephony/providers"
mkdir -p "src/plugins/stt"
mkdir -p "src/plugins/llm"
mkdir -p "src/plugins/tts"
mkdir -p "src/tools"
mkdir -p "src/storage/models"
mkdir -p "src/observability"
mkdir -p "src/utils"
mkdir -p "dashboard/src"
mkdir -p "tests/unit"
mkdir -p "tests/integration"
mkdir -p "tests/load"
mkdir -p "tests/fixtures"
mkdir -p "scripts"
mkdir -p "config/agents"
mkdir -p "examples"
mkdir -p "migrations"
mkdir -p "data/piper"

# --- file contents ---
cat > ".env.example" <<'ENDOFFILE__env_example'
# LiveKit (required for `dev` mode; optional for `console` on recent SDK versions)
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Local Ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=huihui_ai/qwen3-abliterated:8b

# STT: set for cloud Deepgram; leave unset to use local faster-whisper
DEEPGRAM_API_KEY=

# TTS: piper (default on Py3.12) or coqui (Python 3.11 only)
TTS_PROVIDER=piper
COQUI_MODEL=tts_models/en/ljspeech/tacotron2-DDC
PIPER_VOICE=en_US-lessac-medium
PIPER_DATA_DIR=data/piper

# Local Whisper when DEEPGRAM_API_KEY is empty
WHISPER_MODEL=base.en
ENDOFFILE__env_example

cat > ".gitignore" <<'ENDOFFILE__gitignore'
.venv/
venv/
__pycache__/
*.py[cod]
.env
.env.local
*.egg-info/
dist/
build/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.log
.DS_Store
ENDOFFILE__gitignore

cat > "Makefile" <<'ENDOFFILE_Makefile'
.PHONY: venv install demo-console demo-dev

venv:
	python3 -m venv .venv
	.venv/bin/pip install -U pip wheel
	.venv/bin/pip install -r requirements.txt

install: venv

demo-console:
	.venv/bin/python examples/local_voice_demo.py console

demo-dev:
	.venv/bin/python examples/local_voice_demo.py dev
ENDOFFILE_Makefile

cat > "README.md" <<'ENDOFFILE_README_md'
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
ENDOFFILE_README_md

cat > "docs/getting-started.md" <<'ENDOFFILE_docs_getting_started_md'
# Phase 1 local demo

## Prerequisites

1. **Python 3.11+** (3.12 OK with Piper TTS; Coqui needs 3.11)
2. **Ollama** running locally with your model:

   ```bash
   ollama pull huihui_ai/qwen3-abliterated:8b
   ollama serve   # http://localhost:11434
   ```

3. **Microphone + speakers** for console mode

## Setup

```bash
cd voice-ai-platform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### STT

- **Deepgram (recommended for latency):** set `DEEPGRAM_API_KEY` in `.env`
- **Offline fallback:** leave `DEEPGRAM_API_KEY` empty; uses `faster-whisper` (`WHISPER_MODEL`, default `base.en`)

### TTS

- **Default:** `TTS_PROVIDER=piper` — self-hosted; first run downloads the Piper voice into `PIPER_DATA_DIR`
- **Coqui:** set `TTS_PROVIDER=coqui` on **Python 3.11** with `pip install TTS`

## Run

```bash
source .venv/bin/activate
python examples/local_voice_demo.py console
```

Text-only console (no mic):

```bash
python examples/local_voice_demo.py console --text
```

With a local LiveKit server:

```bash
python examples/local_voice_demo.py dev
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Cannot reach Ollama | Ensure `ollama serve` on the same machine as the demo; check `OLLAMA_BASE_URL` |
| Coqui install fails | Use Python 3.11 or switch to `TTS_PROVIDER=piper` |
| Slow first Whisper run | Model download; try `WHISPER_MODEL=tiny.en` for tests |
| No audio in console | Install PortAudio: `sudo apt install libportaudio2` |
ENDOFFILE_docs_getting_started_md

cat > "examples/local_voice_demo.py" <<'ENDOFFILE_examples_local_voice_demo_py'
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
ENDOFFILE_examples_local_voice_demo_py

cat > "requirements.txt" <<'ENDOFFILE_requirements_txt'
# LiveKit Agents core + common plugins (Phase 1 local demo)
livekit-agents[openai,deepgram,silero]~=1.2
python-dotenv>=1.0.0

# Local STT fallback (when DEEPGRAM_API_KEY is unset)
faster-whisper>=1.1.0

# Self-hosted TTS default (works on Python 3.12)
piper-tts>=1.2.0

# Optional: Coqui TTS — install only on Python 3.11: pip install TTS
ENDOFFILE_requirements_txt

cat > "src/agents/__init__.py" <<'ENDOFFILE_src_agents___init___py'

ENDOFFILE_src_agents___init___py

cat > "src/agents/local_assistant.py" <<'ENDOFFILE_src_agents_local_assistant_py'
"""Local voice assistant agent for Phase 1 demos."""

from livekit.agents import Agent

LOCAL_ASSISTANT_INSTRUCTIONS = """
You are a helpful phone assistant for calliotel.ai.
Keep replies concise and conversational (one or two short sentences).
Do not use markdown, emojis, or long lists unless the caller asks.
""".strip()


def build_local_assistant() -> Agent:
    return Agent(instructions=LOCAL_ASSISTANT_INSTRUCTIONS)
ENDOFFILE_src_agents_local_assistant_py

cat > "src/api/__init__.py" <<'ENDOFFILE_src_api___init___py'

ENDOFFILE_src_api___init___py

cat > "src/observability/__init__.py" <<'ENDOFFILE_src_observability___init___py'

ENDOFFILE_src_observability___init___py

cat > "src/orchestration/__init__.py" <<'ENDOFFILE_src_orchestration___init___py'

ENDOFFILE_src_orchestration___init___py

cat > "src/plugins/__init__.py" <<'ENDOFFILE_src_plugins___init___py'

ENDOFFILE_src_plugins___init___py

cat > "src/plugins/llm/__init__.py" <<'ENDOFFILE_src_plugins_llm___init___py'

ENDOFFILE_src_plugins_llm___init___py

cat > "src/plugins/stt/__init__.py" <<'ENDOFFILE_src_plugins_stt___init___py'

ENDOFFILE_src_plugins_stt___init___py

cat > "src/plugins/stt/faster_whisper_stt.py" <<'ENDOFFILE_src_plugins_stt_faster_whisper_stt_py'
from __future__ import annotations

import asyncio
import uuid
import numpy as np
from faster_whisper import WhisperModel
from livekit.agents import stt
from livekit.agents.types import NOT_GIVEN, APIConnectOptions, NotGivenOr
from livekit.agents.utils import AudioBuffer, combine_frames


def _buffer_to_mono_f32(buffer: AudioBuffer, target_rate: int = 16000) -> tuple[np.ndarray, int]:
    frames = buffer if isinstance(buffer, list) else [buffer]
    if not frames:
        return np.array([], dtype=np.float32), target_rate

    combined = combine_frames(frames)
    samples = np.frombuffer(combined.data, dtype=np.int16).astype(np.float32) / 32768.0
    if combined.num_channels > 1:
        samples = samples.reshape(-1, combined.num_channels).mean(axis=1)

    rate = combined.sample_rate
    if rate != target_rate and len(samples) > 0:
        duration = len(samples) / rate
        new_len = max(1, int(duration * target_rate))
        x_old = np.linspace(0.0, 1.0, num=len(samples), endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=new_len, endpoint=False)
        samples = np.interp(x_new, x_old, samples).astype(np.float32)
        rate = target_rate

    return samples, rate


class FasterWhisperSTT(stt.STT):
    def __init__(
        self,
        *,
        model: str = "base.en",
        device: str = "auto",
        compute_type: str = "default",
    ) -> None:
        super().__init__(
            capabilities=stt.STTCapabilities(
                streaming=False,
                interim_results=False,
                offline_recognize=True,
            )
        )
        self._model_name = model
        self._device = device
        self._compute_type = compute_type
        self._model: WhisperModel | None = None
        self._lock = asyncio.Lock()

    @property
    def model(self) -> str:
        return self._model_name

    @property
    def provider(self) -> str:
        return "faster-whisper"

    def _get_model(self) -> WhisperModel:
        if self._model is None:
            self._model = WhisperModel(
                self._model_name,
                device=self._device,
                compute_type=self._compute_type,
            )
        return self._model

    async def _recognize_impl(
        self,
        buffer: AudioBuffer,
        *,
        language: NotGivenOr[str] = NOT_GIVEN,
        conn_options: APIConnectOptions,
    ) -> stt.SpeechEvent:
        audio, _sample_rate = _buffer_to_mono_f32(buffer)

        def _transcribe() -> str:
            model = self._get_model()
            lang = language if language is not NOT_GIVEN else None
            segments, _info = model.transcribe(
                audio,
                language=lang,
                vad_filter=True,
            )
            return " ".join(segment.text.strip() for segment in segments).strip()

        async with self._lock:
            text = await asyncio.to_thread(_transcribe)

        return stt.SpeechEvent(
            type=stt.SpeechEventType.FINAL_TRANSCRIPT,
            request_id=str(uuid.uuid4()),
            alternatives=[stt.SpeechData(language="en", text=text)],
        )
ENDOFFILE_src_plugins_stt_faster_whisper_stt_py

cat > "src/plugins/tts/__init__.py" <<'ENDOFFILE_src_plugins_tts___init___py'

ENDOFFILE_src_plugins_tts___init___py

cat > "src/plugins/tts/coqui_tts.py" <<'ENDOFFILE_src_plugins_tts_coqui_tts_py'
from __future__ import annotations

import asyncio
import io
import sys
import wave

from livekit.agents import DEFAULT_API_CONNECT_OPTIONS, tts, utils
from livekit.agents.types import APIConnectOptions

SAMPLE_RATE = 22050
NUM_CHANNELS = 1


class CoquiTTS(tts.TTS):
    """Coqui TTS wrapper. Requires Python 3.9–3.11 (no PyPI wheels for 3.12+)."""

    def __init__(self, *, model_name: str) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=SAMPLE_RATE,
            num_channels=NUM_CHANNELS,
        )
        self._model_name = model_name
        self._engine = None
        self._init_error: str | None = None
        self._lock = asyncio.Lock()

    @property
    def model(self) -> str:
        return self._model_name

    @property
    def provider(self) -> str:
        return "coqui"

    def _load_engine(self):
        if self._engine is not None:
            return self._engine
        if self._init_error:
            raise RuntimeError(self._init_error)
        try:
            from TTS.api import TTS as CoquiEngine
        except ImportError as exc:
            self._init_error = (
                "Coqui TTS is not installed or unsupported on this Python version "
                f"({sys.version_info.major}.{sys.version_info.minor}). "
                "Use Python 3.11 with `pip install TTS`, or set TTS_PROVIDER=piper."
            )
            raise RuntimeError(self._init_error) from exc

        self._engine = CoquiEngine(model_name=self._model_name, progress_bar=False)
        return self._engine

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> tts.ChunkedStream:
        return _CoquiChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class _CoquiChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts: CoquiTTS, input_text: str, conn_options: APIConnectOptions) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._tts = tts

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        text = self._input_text

        def _synthesize() -> tuple[bytes, int]:
            engine = self._tts._load_engine()
            buf = io.BytesIO()
            engine.tts_to_file(text=text, file_path=buf)
            buf.seek(0)
            with wave.open(buf, "rb") as wf:
                rate = wf.getframerate()
                pcm = wf.readframes(wf.getnframes())
            return pcm, rate

        async with self._tts._lock:
            pcm, sample_rate = await asyncio.to_thread(_synthesize)

        output_emitter.initialize(
            request_id=utils.shortuuid(),
            sample_rate=sample_rate,
            num_channels=NUM_CHANNELS,
            mime_type="audio/pcm",
        )
        output_emitter.push(pcm)
        output_emitter.flush()
ENDOFFILE_src_plugins_tts_coqui_tts_py

cat > "src/plugins/tts/piper_tts.py" <<'ENDOFFILE_src_plugins_tts_piper_tts_py'
from __future__ import annotations

import asyncio
import re
import uuid
from pathlib import Path

from livekit.agents import DEFAULT_API_CONNECT_OPTIONS, tts
from livekit.agents.types import APIConnectOptions

NUM_CHANNELS = 1
_VOICE_PATTERN = re.compile(
    r"^(?P<lang_family>[^-]+)_(?P<lang_region>[^-]+)-(?P<voice_name>[^-]+)-(?P<voice_quality>.+)$"
)


def _voice_paths(voice: str, data_dir: Path) -> tuple[Path, Path]:
    match = _VOICE_PATTERN.match(voice.strip())
    if not match:
        raise ValueError(
            f"Invalid PIPER_VOICE {voice!r}; expected like 'en_US-lessac-medium'"
        )
    lang_code = match.group("lang_family") + "_" + match.group("lang_region")
    voice_code = (
        f"{lang_code}-{match.group('voice_name')}-{match.group('voice_quality')}"
    )
    return data_dir / f"{voice_code}.onnx", data_dir / f"{voice_code}.onnx.json"


class PiperTTS(tts.TTS):
    def __init__(self, *, voice: str, data_dir: str | Path) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=22050,
            num_channels=NUM_CHANNELS,
        )
        self._voice_name = voice
        self._data_dir = Path(data_dir)
        self._voice = None
        self._lock = asyncio.Lock()

    @property
    def model(self) -> str:
        return self._voice_name

    @property
    def provider(self) -> str:
        return "piper"

    def _load_voice(self):
        if self._voice is not None:
            return self._voice
        from piper import PiperVoice
        from piper.download_voices import download_voice

        self._data_dir.mkdir(parents=True, exist_ok=True)
        download_voice(self._voice_name, self._data_dir)
        model_path, config_path = _voice_paths(self._voice_name, self._data_dir)
        self._voice = PiperVoice.load(model_path, config_path=config_path)
        return self._voice

    def prewarm(self) -> None:
        try:
            self._load_voice()
        except Exception:
            pass

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> tts.ChunkedStream:
        return _PiperChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class _PiperChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts: PiperTTS, input_text: str, conn_options: APIConnectOptions) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._tts = tts

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        text = self._input_text

        def _synthesize() -> tuple[bytes, int]:
            voice = self._tts._load_voice()
            chunks = list(voice.synthesize(text))
            if not chunks:
                return b"", voice.config.sample_rate
            pcm = b"".join(chunk.audio_int16_bytes for chunk in chunks)
            return pcm, voice.config.sample_rate

        async with self._tts._lock:
            pcm, sample_rate = await asyncio.to_thread(_synthesize)

        output_emitter.initialize(
            request_id=str(uuid.uuid4()),
            sample_rate=sample_rate,
            num_channels=NUM_CHANNELS,
            mime_type="audio/pcm",
        )
        if pcm:
            output_emitter.push(pcm)
        output_emitter.flush()
ENDOFFILE_src_plugins_tts_piper_tts_py

cat > "src/storage/__init__.py" <<'ENDOFFILE_src_storage___init___py'

ENDOFFILE_src_storage___init___py

cat > "src/storage/models/__init__.py" <<'ENDOFFILE_src_storage_models___init___py'

ENDOFFILE_src_storage_models___init___py

cat > "src/telephony/__init__.py" <<'ENDOFFILE_src_telephony___init___py'

ENDOFFILE_src_telephony___init___py

cat > "src/telephony/providers/__init__.py" <<'ENDOFFILE_src_telephony_providers___init___py'

ENDOFFILE_src_telephony_providers___init___py

cat > "src/tools/__init__.py" <<'ENDOFFILE_src_tools___init___py'

ENDOFFILE_src_tools___init___py

cat > "src/utils/__init__.py" <<'ENDOFFILE_src_utils___init___py'

ENDOFFILE_src_utils___init___py

cat > "src/utils/config.py" <<'ENDOFFILE_src_utils_config_py'
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str
    ollama_model: str
    deepgram_api_key: str
    whisper_model: str
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
ENDOFFILE_src_utils_config_py

cat > "src/utils/providers.py" <<'ENDOFFILE_src_utils_providers_py'
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
    return FasterWhisperSTT(model=settings.whisper_model)


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
ENDOFFILE_src_utils_providers_py

chmod +x examples/local_voice_demo.py

# --- python virtualenv ---
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -U pip wheel setuptools
pip install -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo ""
echo "Setup complete in: $(pwd)"
echo "Next:"
echo "  source .venv/bin/activate"
echo "  ollama pull huihui_ai/qwen3-abliterated:8b"
echo "  ollama serve"
echo "  python examples/local_voice_demo.py console"
