#!/usr/bin/env bash
# frontend/deploy.sh — Build and deploy the Calliotel frontend to production.
# Usage: bash frontend/deploy.sh
# Requires: .ssh_deploy/id_ed25519 (deploy key with write access to the server)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_KEY="$REPO_ROOT/.ssh_deploy/id_ed25519"
REMOTE_USER="root"
REMOTE_HOST="159.223.99.35"
REMOTE_PATH="/var/www/calliotel/build/"
BUILD_DIR="$SCRIPT_DIR/build"

# ── 1. Build ─────────────────────────────────────────────────────────────────
echo "==> Building frontend…"
cd "$SCRIPT_DIR"
yarn build

# ── 2. Sanity-check: make sure CSS was emitted ────────────────────────────────
CSS_FILE=$(find "$BUILD_DIR/static/css" -maxdepth 1 -name "main.*.css" | head -n 1)
JS_FILE=$(find  "$BUILD_DIR/static/js"  -maxdepth 1 -name "main.*.js"  | head -n 1)

if [[ -z "$CSS_FILE" ]]; then
  echo "ERROR: No main.*.css found in build/static/css/ — aborting deploy." >&2
  exit 1
fi
if [[ -z "$JS_FILE" ]]; then
  echo "ERROR: No main.*.js found in build/static/js/ — aborting deploy." >&2
  exit 1
fi

echo "==> CSS  → $(basename "$CSS_FILE")"
echo "==> JS   → $(basename "$JS_FILE")"
echo "==> HTML → index.html"

# ── 3. Deploy (rsync entire build directory) ─────────────────────────────────
echo "==> Uploading to $REMOTE_HOST:$REMOTE_PATH …"

chmod 600 "$DEPLOY_KEY"

rsync -az --delete \
  -e "ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=no -o BatchMode=yes" \
  "$BUILD_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

echo "==> Deploy complete ✓"
echo "    CSS:  $REMOTE_PATH/static/css/$(basename "$CSS_FILE")"
echo "    JS:   $REMOTE_PATH/static/js/$(basename "$JS_FILE")"
echo "    HTML: ${REMOTE_PATH}index.html"
