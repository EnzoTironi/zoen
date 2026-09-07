#!/usr/bin/env bash
# Zoen all-in-one: Postgres + RustFS (S3) + server on one Fly machine / volume.
# module-resolution via /app/ops/node_modules -> apps/server/node_modules
set -euo pipefail

DATA_ROOT="${ZOEN_DATA_ROOT:-/data}"
PGDATA="${PGDATA:-${DATA_ROOT}/postgres}"
OBJECT_DATA="${ZOEN_OBJECT_DATA:-${DATA_ROOT}/object}"
ZOEN_STATE="${ZOEN_STATE_DIR:-${DATA_ROOT}/zoen}"
export PATH="/usr/lib/postgresql/18/bin:${PATH}"

mkdir -p "${PGDATA}" "${OBJECT_DATA}" "${ZOEN_STATE}"
chown -R postgres:postgres "${PGDATA}"

if [[ ! -s "${PGDATA}/PG_VERSION" ]]; then
  echo "all-in-one: initializing Postgres under ${PGDATA}"
  gosu postgres initdb \
    --pgdata="${PGDATA}" \
    --username=zoen_infra \
    --auth-host=trust \
    --auth-local=trust \
    --encoding=UTF8 \
    --locale=C.UTF-8
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "unix_socket_directories = '/tmp'"
    echo "max_connections = 40"
    echo "shared_buffers = 128MB"
  } >>"${PGDATA}/postgresql.conf"
  echo "host all all 127.0.0.1/32 trust" >>"${PGDATA}/pg_hba.conf"
  echo "local all all trust" >>"${PGDATA}/pg_hba.conf"
fi

echo "all-in-one: starting Postgres"
gosu postgres pg_ctl \
  --pgdata="${PGDATA}" \
  --wait \
  --options="-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp" \
  start

# Default loopback-only object-store credentials (not Fly secrets; not public).
export RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-${ZOEN_S3_ACCESS_KEY:-zoenlocal}}"
export RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-${ZOEN_S3_SECRET_KEY:-zoenlocal-secret-key-min-32b}}"
export RUSTFS_CONSOLE_ENABLE="${RUSTFS_CONSOLE_ENABLE:-false}"
export RUSTFS_OBS_LOGGER_LEVEL="${RUSTFS_OBS_LOGGER_LEVEL:-warn}"
export ZOEN_S3_ACCESS_KEY="${ZOEN_S3_ACCESS_KEY:-${RUSTFS_ACCESS_KEY}}"
export ZOEN_S3_SECRET_KEY="${ZOEN_S3_SECRET_KEY:-${RUSTFS_SECRET_KEY}}"

echo "all-in-one: starting RustFS on ${OBJECT_DATA}"
/usr/local/bin/rustfs "${OBJECT_DATA}" &
RUSTFS_PID=$!

echo "all-in-one: waiting for Postgres"
for _ in $(seq 1 60); do
  if gosu postgres pg_isready -h 127.0.0.1 -U zoen_infra -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
gosu postgres pg_isready -h 127.0.0.1 -U zoen_infra -d postgres
# Harmless if already present
gosu postgres psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null

echo "all-in-one: waiting for RustFS"
for _ in $(seq 1 60); do
  if node --input-type=module -e \
    'const u=process.env.U; try { const r=await fetch(u); process.exit(r.ok?0:1);} catch { process.exit(1); }' \
    U="http://127.0.0.1:9000/health/ready"; then
    break
  fi
  sleep 0.5
done
node --input-type=module -e \
  'const r=await fetch("http://127.0.0.1:9000/health/ready"); if(!r.ok) process.exit(1);'

export ZOEN_BOOTSTRAP_ADMIN_URL="${ZOEN_BOOTSTRAP_ADMIN_URL:-postgresql://zoen_infra@127.0.0.1:5432/postgres}"
export ZOEN_S3_ENDPOINT="${ZOEN_S3_ENDPOINT:-http://127.0.0.1:9000}"
export ZOEN_S3_REGION="${ZOEN_S3_REGION:-us-east-1}"
export ZOEN_S3_BUCKET="${ZOEN_S3_BUCKET:-zoen}"
export ZOEN_INSTALLATION_FILE="${ZOEN_INSTALLATION_FILE:-${ZOEN_STATE}/installation.json}"
export ZOEN_RUNTIME_ENV_FILE="${ZOEN_RUNTIME_ENV_FILE:-${ZOEN_STATE}/runtime.env}"
export ZOEN_WORLD_POLICY="${ZOEN_WORLD_POLICY:-d04-hosted-retained-v1}"
export ZOEN_RELEASE_FILE="${ZOEN_RELEASE_FILE:-/app/apps/server/dist/release.json}"

echo "all-in-one: provisioning / migrating if needed"
# Resolve workspace prod deps (apps/server) while running ops bootstrap sources.
export NODE_PATH="/app/apps/server/node_modules:/app/node_modules${NODE_PATH:+:$NODE_PATH}"
node /app/apps/server/scripts/all-in-one-bootstrap.ts

# Load durable loopback DB URLs from the volume (never log values).
set -a
# shellcheck disable=SC1090
source "${ZOEN_RUNTIME_ENV_FILE}"
set +a

cleanup() {
  echo "all-in-one: shutting down"
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill -TERM "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  gosu postgres pg_ctl --pgdata="${PGDATA}" --mode=fast --wait stop 2>/dev/null || true
  if [[ -n "${RUSTFS_PID:-}" ]]; then
    kill -TERM "${RUSTFS_PID}" 2>/dev/null || true
    wait "${RUSTFS_PID}" 2>/dev/null || true
  fi
}
trap cleanup TERM INT

echo "all-in-one: starting Zoen server on ${ZOEN_LISTEN_HOST:-0.0.0.0}:${ZOEN_PORT:-4310}"
node /app/apps/server/dist/main.js &
SERVER_PID=$!
wait "${SERVER_PID}"
status=$?
cleanup
exit "${status}"
