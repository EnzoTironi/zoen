#!/usr/bin/env bash
# Re-capture Fly + DNS inventory (secret names only). Writes ops/fly/evidence/inventory-<UTC>.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EV_DIR="${ROOT}/ops/fly/evidence"
mkdir -p "${EV_DIR}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${EV_DIR}/inventory-${TS}.md"
strip() { sed 's/\x1b\[[0-9;]*m//g'; }

{
  echo "# Legacy cutover inventory"
  echo
  echo "- Captured (UTC): ${TS}"
  echo "- Captured (America/Sao_Paulo): $(TZ=America/Sao_Paulo date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "- Operator: $(fly auth whoami 2>/dev/null || true)"
  echo
  for app in zoen-rebuild zoen; do
    echo "## ${app}"
    echo '```'
    fly status -a "${app}" 2>&1 | strip
    fly checks list -a "${app}" 2>&1 | strip
    fly ips list -a "${app}" 2>&1 | strip
    fly certs list -a "${app}" 2>&1 | strip
    fly secrets list -a "${app}" 2>&1 | strip
    fly volumes list -a "${app}" 2>&1 | strip
    echo '```'
    echo
  done
  echo "## DNS"
  echo '```'
  dig +short tironi.xyz NS
  dig @1.1.1.1 zoen.tironi.xyz A +noall +answer
  dig @1.1.1.1 zoen.tironi.xyz AAAA +noall +answer
  dig @1.1.1.1 zoen-rebuild.fly.dev A +noall +answer
  dig @1.1.1.1 zoen-rebuild.fly.dev AAAA +noall +answer
  dig @1.1.1.1 zoen.fly.dev A +noall +answer
  dig @1.1.1.1 zoen.fly.dev AAAA +noall +answer
  echo '```'
} > "${OUT}"
echo "Wrote ${OUT}"
