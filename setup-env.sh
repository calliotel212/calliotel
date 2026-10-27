#!/usr/bin/env bash
# Add the Drama Me production keys, then deploy.
# From your terminal, in this repo: bash setup-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! vercel whoami; then
  echo "Vercel is not logged in. Run vercel login, then run bash setup-env.sh from your terminal."
  exit 1
fi

read -r -s -p "ElevenLabs API key: " ELEVENLABS_API_KEY
printf '\n'
read -r -s -p "fal.ai API key: " FAL_API_KEY
printf '\n'

if [[ -z "${ELEVENLABS_API_KEY}" || -z "${FAL_API_KEY}" ]]; then
  echo "Both API keys are required. Run bash setup-env.sh from your terminal."
  exit 1
fi

# The Next.js app lives in dramame/, not in the repo-root Calliotel app.
# Stay at the repo root only when this checkout is already linked there.
if [[ -f "$ROOT/.vercel/project.json" && ! -f "$ROOT/dramame/.vercel/project.json" ]]; then
  cd "$ROOT"
  DEPLOYED_FROM="the repo root"
else
  cd "$ROOT/dramame"
  DEPLOYED_FROM="dramame/"
fi

printf '%s' "$ELEVENLABS_API_KEY" | vercel env add ELEVENLABS_API_KEY production
printf '%s' "$FAL_API_KEY" | vercel env add FAL_API_KEY production
vercel --prod

unset ELEVENLABS_API_KEY
unset FAL_API_KEY

echo "vercel --prod ran from ${DEPLOYED_FROM}."
if [[ "$DEPLOYED_FROM" == "dramame/" ]]; then
  echo "The Next.js app lives in dramame/, so this script changed into that directory before vercel env add and vercel --prod."
fi
echo "Run bash setup-env.sh from your terminal."
