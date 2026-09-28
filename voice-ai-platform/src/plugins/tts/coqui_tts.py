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
