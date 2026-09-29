#!/usr/bin/env bash
# Idempotent-ish bootstrap for a fresh Ubuntu DigitalOcean droplet.
# Installs Docker, clones calliotel, and starts voice-ai-platform via Compose.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/calliotel212/calliotel.git}"
REPO_DIR="${REPO_DIR:-/opt/calliotel}"
BRANCH="${BRANCH:-main}"

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get upgrade -y
  apt-get install -y ca-certificates curl git
  apt-get install -y docker.io docker-compose-v2 || apt-get install -y docker.io
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 plugin not found; install docker-compose-v2 and re-run." >&2
  exit 1
fi

if [[ ! -d "${REPO_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${REPO_DIR}"
fi

cd "${REPO_DIR}"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}" || true

cd "${REPO_DIR}/voice-ai-platform"

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example — edit LiveKit and API keys before production traffic."
fi

chmod +x scripts/digitalocean/ollama-entrypoint.sh

docker compose pull --ignore-buildable || true
docker compose build
docker compose up -d

echo "Stack started. Verify: docker compose ps"
echo "Optional: docker compose exec ollama ollama list"
