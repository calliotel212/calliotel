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
