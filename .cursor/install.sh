#!/usr/bin/env bash
# Idempotent Cloud Agent setup for Calliotel (React frontend + FastAPI local backend).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── System deps ──────────────────────────────────────────────────────────────
# Python 3.12 on Ubuntu ships without the venv module; install it once.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  echo "==> Installing python3-venv"
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3.12-venv
fi

# ── Backend (secret-free local API, in-memory DB) ────────────────────────────
echo "==> Setting up backend venv"
cd "$REPO_ROOT/_server_backend"
if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r requirements-local.txt

# ── Frontend (Create React App + craco) ──────────────────────────────────────
echo "==> Installing frontend dependencies"
cd "$REPO_ROOT"
yarn install --network-timeout 300000

echo "==> Install complete"
