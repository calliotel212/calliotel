FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml requirements.txt README.md ./
COPY src ./src
COPY livekit.toml ./

RUN pip install --upgrade pip \
    && pip install . \
    && python -m livekit.agents download-files

RUN mkdir -p /data/piper

ENV PIPER_DATA_DIR=/data/piper

CMD ["python", "-m", "livekit.agents", "start", "src/agents/worker.py", "--log-level", "INFO"]
