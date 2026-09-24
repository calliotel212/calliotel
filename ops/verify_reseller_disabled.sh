#!/usr/bin/env bash
# Verify the reseller/developer programmatic API is disabled on a running server.
# When the kill-switch is active (RESELLER_API_ENABLED unset), every endpoint
# below is unmounted and returns 404. Any other code (200/401/403/422) means the
# router is STILL MOUNTED — check RESELLER_API_ENABLED and redeploy/restart.
#
# Usage: bash ops/verify_reseller_disabled.sh [BASE_URL]
#   BASE_URL defaults to https://calliotel.com
set -euo pipefail

BASE="${1:-https://calliotel.com}"
echo "==> Checking reseller/developer endpoints on ${BASE} (expect 404)…"

# "path:METHOD" — real endpoints that exist only when the routers are mounted.
CHECKS=(
  "/api/reseller-api/apply:POST"
  "/api/reseller/become:POST"
  "/api/reseller/me:GET"
  "/api/developer/keys:GET"
)

fail=0
for entry in "${CHECKS[@]}"; do
  path="${entry%%:*}"
  method="${entry##*:}"
  code="$(curl -s -o /dev/null -w '%{http_code}' -X "${method}" "${BASE}${path}" || echo 000)"
  if [ "${code}" = "404" ]; then
    printf '  OK    %-6s %-28s -> %s\n' "${method}" "${path}" "${code}"
  else
    printf '  WARN  %-6s %-28s -> %s (still mounted?)\n' "${method}" "${path}" "${code}"
    fail=1
  fi
done

echo
if [ "${fail}" = "0" ]; then
  echo "✅ All reseller/developer endpoints return 404 — kill-switch is active."
else
  echo "❌ Some endpoints did not return 404. Ensure RESELLER_API_ENABLED is unset,"
  echo "   redeploy _server_backend/server.py, and restart the backend."
  exit 1
fi
