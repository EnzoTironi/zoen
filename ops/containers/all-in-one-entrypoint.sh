#!/usr/bin/env bash
# Zoen all-in-one: Postgres + RustFS (S3) + server on one Fly machine / volume.
# ZA-05: distinct bootstrap / DB / object-store / app identities on one profile.
# module-resolution via /app/ops/node_modules -> apps/server/node_modules
set -euo pipefail

DATA_ROOT="${ZOEN_DATA_ROOT:-/data}"
PGDATA="${PGDATA:-${DATA_ROOT}/postgres}"
OBJECT_DATA="${ZOEN_OBJECT_DATA:-${DATA_ROOT}/object}"
ZOEN_STATE="${ZOEN_STATE_DIR:-${DATA_ROOT}/zoen}"
BOOTSTRAP_DIR="${ZOEN_BOOTSTRAP_DIR:-${ZOEN_STATE}/bootstrap}"
PG_INFRA_PASSWORD_FILE="${BOOTSTRAP_DIR}/pg-infra.password"
RUSTFS_ACCESS_KEY_FILE="${BOOTSTRAP_DIR}/rustfs-access-key"
RUSTFS_SECRET_KEY_FILE="${BOOTSTRAP_DIR}/rustfs-secret-key"
export PATH="/usr/lib/postgresql/18/bin:${PATH}"

umask 077

mkdir -p "${PGDATA}" "${OBJECT_DATA}" "${ZOEN_STATE}" "${BOOTSTRAP_DIR}"
chown -R postgres:postgres "${PGDATA}"
chown root:root "${BOOTSTRAP_DIR}"
chmod 700 "${BOOTSTRAP_DIR}"

write_secret_file() {
  local path="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp "${path}.tmp.XXXXXX")"
  printf '%s' "${value}" >"${tmp}"
  chmod 600 "${tmp}"
  mv -f "${tmp}" "${path}"
}

ensure_secret_file() {
  local path="$1"
  local generator="$2"
  if [[ -s "${path}" ]]; then
    chmod 600 "${path}"
    return 0
  fi
  write_secret_file "${path}" "$(eval "${generator}")"
}

write_scram_hba() {
  {
    echo "# ZA-05 enforced identities — do not restore trust auth"
    echo "local all zoen_infra peer map=zoen_os"
    echo "local all all scram-sha-256"
    echo "host all all 127.0.0.1/32 scram-sha-256"
    echo "host all all ::1/128 scram-sha-256"
  } >"${PGDATA}/pg_hba.conf"
  {
    echo "# ZA-05: OS postgres may maintain DB role zoen_infra via peer"
    echo "zoen_os postgres zoen_infra"
  } >"${PGDATA}/pg_ident.conf"
  chown postgres:postgres "${PGDATA}/pg_hba.conf" "${PGDATA}/pg_ident.conf"
}

# Durable infra password (never logged). Prefer explicit env on first boot only.
if [[ -n "${ZOEN_PG_INFRA_PASSWORD:-}" ]]; then
  write_secret_file "${PG_INFRA_PASSWORD_FILE}" "${ZOEN_PG_INFRA_PASSWORD}"
  unset ZOEN_PG_INFRA_PASSWORD
fi
ensure_secret_file "${PG_INFRA_PASSWORD_FILE}" 'openssl rand -hex 32'
PG_INFRA_PASSWORD="$(cat "${PG_INFRA_PASSWORD_FILE}")"

# Object-store root credentials: explicit env wins on first materialization; else generate.
# Object-store root credentials: explicit env on first boot, else generate (no silent zoenlocal default).
if [[ -n "${RUSTFS_ACCESS_KEY:-}${ZOEN_S3_ACCESS_KEY:-}" && -n "${RUSTFS_SECRET_KEY:-}${ZOEN_S3_SECRET_KEY:-}" ]]; then
  write_secret_file "${RUSTFS_ACCESS_KEY_FILE}" "${RUSTFS_ACCESS_KEY:-${ZOEN_S3_ACCESS_KEY}}"
  write_secret_file "${RUSTFS_SECRET_KEY_FILE}" "${RUSTFS_SECRET_KEY:-${ZOEN_S3_SECRET_KEY}}"
fi
ensure_secret_file "${RUSTFS_ACCESS_KEY_FILE}" 'openssl rand -hex 16'
ensure_secret_file "${RUSTFS_SECRET_KEY_FILE}" 'openssl rand -hex 32'
unset RUSTFS_ACCESS_KEY RUSTFS_SECRET_KEY ZOEN_S3_ACCESS_KEY ZOEN_S3_SECRET_KEY || true

NEEDS_TRUST_UPGRADE=0
if [[ -s "${PGDATA}/PG_VERSION" ]] && grep -Eq '^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]].*trust' "${PGDATA}/pg_hba.conf" 2>/dev/null; then
  NEEDS_TRUST_UPGRADE=1
fi

if [[ ! -s "${PGDATA}/PG_VERSION" ]]; then
  echo "all-in-one: initializing Postgres under ${PGDATA}"
  PWFILE="$(mktemp /tmp/pg-pwfile.XXXXXX)"
  printf '%s\n' "${PG_INFRA_PASSWORD}" >"${PWFILE}"
  chown postgres:postgres "${PWFILE}"
  chmod 600 "${PWFILE}"
  gosu postgres initdb \
    --pgdata="${PGDATA}" \
    --username=zoen_infra \
    --pwfile="${PWFILE}" \
    --auth-host=scram-sha-256 \
    --auth-local=scram-sha-256 \
    --encoding=UTF8 \
    --locale=C.UTF-8
  rm -f "${PWFILE}"
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "unix_socket_directories = '/tmp'"
    echo "max_connections = 40"
    echo "shared_buffers = 128MB"
    echo "password_encryption = scram-sha-256"
  } >>"${PGDATA}/postgresql.conf"
  write_scram_hba
fi

echo "all-in-one: starting Postgres"
gosu postgres pg_ctl \
  --pgdata="${PGDATA}" \
  --wait \
  --options="-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp -c password_encryption=scram-sha-256" \
  start

echo "all-in-one: waiting for Postgres"
for _ in $(seq 1 60); do
  if gosu postgres pg_isready -h /tmp -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
gosu postgres pg_isready -h /tmp -d postgres

# Set/rotate infra password. Trust-era volumes: connect without password first.
set_infra_password() {
  # Prefer peer map once HBA is upgraded; for trust-era use host trust / local trust.
  if gosu postgres psql -h /tmp -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT 1" >/dev/null 2>&1; then
    gosu postgres psql -h /tmp -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
      -c "ALTER ROLE zoen_infra WITH LOGIN PASSWORD '${PG_INFRA_PASSWORD}'" >/dev/null
    return 0
  fi
  if gosu postgres psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT 1" >/dev/null 2>&1; then
    gosu postgres psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
      -c "ALTER ROLE zoen_infra WITH LOGIN PASSWORD '${PG_INFRA_PASSWORD}'" >/dev/null
    return 0
  fi
  gosu postgres env PGPASSWORD="${PG_INFRA_PASSWORD}" \
    psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
    -c "ALTER ROLE zoen_infra WITH LOGIN PASSWORD '${PG_INFRA_PASSWORD}'" >/dev/null
}

set_infra_password

if [[ "${NEEDS_TRUST_UPGRADE}" -eq 1 ]] || ! grep -q 'scram-sha-256' "${PGDATA}/pg_hba.conf"; then
  echo "all-in-one: enforcing SCRAM pg_hba"
  write_scram_hba
  gosu postgres pg_ctl --pgdata="${PGDATA}" reload >/dev/null
fi

# Prove password auth on loopback (no trust).
gosu postgres env PGPASSWORD="${PG_INFRA_PASSWORD}" \
  pg_isready -h 127.0.0.1 -U zoen_infra -d postgres
gosu postgres env PGPASSWORD="${PG_INFRA_PASSWORD}" \
  psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null

export RUSTFS_ACCESS_KEY_FILE
export RUSTFS_SECRET_KEY_FILE
export RUSTFS_CONSOLE_ENABLE="${RUSTFS_CONSOLE_ENABLE:-false}"
export RUSTFS_OBS_LOGGER_LEVEL="${RUSTFS_OBS_LOGGER_LEVEL:-warn}"

echo "all-in-one: starting RustFS on ${OBJECT_DATA}"
/usr/local/bin/rustfs "${OBJECT_DATA}" &
RUSTFS_PID=$!

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

# Bootstrap-only credentials (cleared before app start).
ZOEN_S3_ACCESS_KEY="$(cat "${RUSTFS_ACCESS_KEY_FILE}")"
ZOEN_S3_SECRET_KEY="$(cat "${RUSTFS_SECRET_KEY_FILE}")"
export ZOEN_BOOTSTRAP_ADMIN_URL="postgresql://zoen_infra:${PG_INFRA_PASSWORD}@127.0.0.1:5432/postgres"
export ZOEN_S3_ACCESS_KEY ZOEN_S3_SECRET_KEY
export ZOEN_S3_ADMIN_ACCESS_KEY="${ZOEN_S3_ACCESS_KEY}"
export ZOEN_S3_ADMIN_SECRET_KEY="${ZOEN_S3_SECRET_KEY}"
export ZOEN_S3_ENDPOINT="${ZOEN_S3_ENDPOINT:-http://127.0.0.1:9000}"
export ZOEN_S3_REGION="${ZOEN_S3_REGION:-us-east-1}"
export ZOEN_S3_BUCKET="${ZOEN_S3_BUCKET:-zoen}"
export ZOEN_INSTALLATION_FILE="${ZOEN_INSTALLATION_FILE:-${ZOEN_STATE}/installation.json}"
export ZOEN_RUNTIME_ENV_FILE="${ZOEN_RUNTIME_ENV_FILE:-${ZOEN_STATE}/runtime.env}"
export ZOEN_WORLD_POLICY="${ZOEN_WORLD_POLICY:-d04-hosted-retained-v1}"
export ZOEN_RELEASE_FILE="${ZOEN_RELEASE_FILE:-/app/apps/server/dist/release.json}"

echo "all-in-one: provisioning / migrating if needed"
export NODE_PATH="/app/apps/server/node_modules:/app/node_modules${NODE_PATH:+:$NODE_PATH}"
if ! node /app/apps/server/scripts/all-in-one-bootstrap.ts; then
  status=$?
  unset ZOEN_BOOTSTRAP_ADMIN_URL ZOEN_S3_ADMIN_ACCESS_KEY ZOEN_S3_ADMIN_SECRET_KEY \
    ZOEN_S3_ACCESS_KEY ZOEN_S3_SECRET_KEY PG_INFRA_PASSWORD || true
  echo "all-in-one: bootstrap failed; application will not start" >&2
  if [[ -n "${RUSTFS_PID:-}" ]]; then
    kill -TERM "${RUSTFS_PID}" 2>/dev/null || true
    wait "${RUSTFS_PID}" 2>/dev/null || true
  fi
  gosu postgres pg_ctl --pgdata="${PGDATA}" --mode=fast --wait stop 2>/dev/null || true
  exit "${status}"
fi

# Drop bootstrap/admin material from this environment before launching the app.
unset ZOEN_BOOTSTRAP_ADMIN_URL ZOEN_S3_ADMIN_ACCESS_KEY ZOEN_S3_ADMIN_SECRET_KEY \
  ZOEN_S3_ACCESS_KEY ZOEN_S3_SECRET_KEY PG_INFRA_PASSWORD || true

# runtime.env + installation are app-readable; bootstrap dir stays root-only.
chown -R zoen:zoen "${ZOEN_STATE}"
chown -R root:root "${BOOTSTRAP_DIR}"
chmod 700 "${BOOTSTRAP_DIR}"
chmod 600 "${PG_INFRA_PASSWORD_FILE}" "${RUSTFS_ACCESS_KEY_FILE}" "${RUSTFS_SECRET_KEY_FILE}"
if [[ -f "${ZOEN_RUNTIME_ENV_FILE}" ]]; then
  chown zoen:zoen "${ZOEN_RUNTIME_ENV_FILE}"
  chmod 600 "${ZOEN_RUNTIME_ENV_FILE}"
fi
if [[ -f "${ZOEN_INSTALLATION_FILE}" ]]; then
  chown zoen:zoen "${ZOEN_INSTALLATION_FILE}"
  chmod 600 "${ZOEN_INSTALLATION_FILE}"
fi
if [[ -f "${ZOEN_STATE}/.bootstrap-complete" ]]; then
  chown zoen:zoen "${ZOEN_STATE}/.bootstrap-complete"
  chmod 600 "${ZOEN_STATE}/.bootstrap-complete"
fi

set -a
# shellcheck disable=SC1090
source "${ZOEN_RUNTIME_ENV_FILE}"
set +a

if [[ -n "${ZOEN_BOOTSTRAP_ADMIN_URL:-}" ]]; then
  echo "all-in-one: refusing to start app with ZOEN_BOOTSTRAP_ADMIN_URL present" >&2
  exit 1
fi

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

echo "all-in-one: starting Zoen server on ${ZOEN_LISTEN_HOST:-0.0.0.0}:${ZOEN_PORT:-4310} as zoen"
gosu zoen env \
  -u RUSTFS_ACCESS_KEY_FILE \
  -u RUSTFS_SECRET_KEY_FILE \
  -u ZOEN_BOOTSTRAP_ADMIN_URL \
  -u ZOEN_S3_ADMIN_ACCESS_KEY \
  -u ZOEN_S3_ADMIN_SECRET_KEY \
  node /app/apps/server/dist/main.js &
SERVER_PID=$!
wait "${SERVER_PID}"
status=$?
cleanup
exit "${status}"
