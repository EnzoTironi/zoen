#!/usr/bin/env bash
# Scale legacy zoen to 0 machines. NEVER destroys the app.
# Requires ZOEN_LEGACY_STOP=I_UNDERSTAND and prior /ready on custom hostname unless FORCE=1.
set -euo pipefail

LEGACY_APP="${LEGACY_APP:-zoen}"
CUSTOM_URL="${CUSTOM_READY_URL:-https://zoen.tironi.xyz/ready}"

if [[ "${ZOEN_LEGACY_STOP:-}" != "I_UNDERSTAND" ]]; then
  echo "Refusing: set ZOEN_LEGACY_STOP=I_UNDERSTAND to scale ${LEGACY_APP} to 0."
  echo "This does not destroy the app or volumes."
  exit 2
fi

if [[ "${FORCE:-}" != "1" ]]; then
  echo "==> gating: ${CUSTOM_URL} must be ready"
  BODY="$(curl -sS --max-time 25 -w '\nHTTP_CODE=%{http_code}\n' "${CUSTOM_URL}")"
  echo "${BODY}"
  echo "${BODY}" | grep -q 'HTTP_CODE=200' || { echo "FAIL: custom hostname not ready; abort stop"; exit 1; }
  echo "${BODY}" | grep -q '"status":"ready"' || { echo "FAIL: custom hostname body not ready; abort stop"; exit 1; }
fi

echo "==> fly scale count 0 -a ${LEGACY_APP}"
fly scale count 0 -a "${LEGACY_APP}" -y
echo "==> status (app must still exist)"
fly status -a "${LEGACY_APP}"
echo "OK: legacy scaled to 0; app retained for rollback."
