#!/usr/bin/env bash
# Add (or show) a custom hostname certificate on zoen-rebuild. Replace path — not dual-app serving.
set -euo pipefail

HOST="${1:-zoen.tironi.xyz}"
APP="${FLY_APP:-zoen-rebuild}"

echo "==> fly certs add ${HOST} -a ${APP}"
fly certs add "${HOST}" -a "${APP}" || true
echo "==> fly certs show ${HOST} -a ${APP}"
fly certs show "${HOST}" -a "${APP}"
echo "==> fly certs list -a ${APP}"
fly certs list -a "${APP}"
