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

### 8GB Mac (low RAM)

For machines with about 8GB RAM (e.g. base MacBook Air), use the low-RAM profile:

```bash
cp .env.lowram.example .env
ollama pull qwen2.5:3b
```

Key settings: `OLLAMA_MODEL=qwen2.5:3b`, `WHISPER_MODEL=tiny.en`, `WHISPER_DEVICE=cpu`, `WHISPER_COMPUTE_TYPE=int8`, `PIPER_VOICE=en_US-lessac-low`, and `WHISPER_VAD_FILTER=false` (Silero VAD already segments speech). The demo preloads Whisper and Piper at startup to reduce first-turn delay.

### STT

- **Deepgram (recommended for latency):** set `DEEPGRAM_API_KEY` in `.env`
- **Offline fallback:** leave `DEEPGRAM_API_KEY` empty; uses `faster-whisper` (`WHISPER_MODEL`, default `base.en`). Optional: `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`, `WHISPER_VAD_FILTER` (leave off when using Silero VAD).

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
