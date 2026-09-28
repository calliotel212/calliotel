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
