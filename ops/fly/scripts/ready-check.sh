#!/usr/bin/env bash
# Prove Zoen hosted /ready. Default: zoen-rebuild.fly.dev with shared-v4 --resolve fallback.
set -euo pipefail

URL="${1:-https://zoen-rebuild.fly.dev/ready}"
REBUILD_V4="${ZOEN_REBUILD_SHARED_V4:-66.241.124.12}"

echo "==> GET ${URL}"
set +e
BODY="$(curl -sS --max-time 25 -w '\nHTTP_CODE=%{http_code}\n' "${URL}" 2>/tmp/zoen-ready-curl.err)"
RC=$?
set -e

if [[ $RC -ne 0 ]] && [[ "${URL}" == *"zoen-rebuild.fly.dev"* ]]; then
  echo "direct curl failed ($(cat /tmp/zoen-ready-curl.err)); retry with --resolve ${REBUILD_V4}"
  BODY="$(curl -sS --max-time 25 -w '\nHTTP_CODE=%{http_code}\n' \
    --resolve "zoen-rebuild.fly.dev:443:${REBUILD_V4}" "${URL}")"
fi

echo "${BODY}"
echo "${BODY}" | grep -q 'HTTP_CODE=200' || { echo "FAIL: expected HTTP 200"; exit 1; }
echo "${BODY}" | grep -q '"status":"ready"' || { echo "FAIL: expected status ready JSON"; exit 1; }
echo "OK: /ready"
