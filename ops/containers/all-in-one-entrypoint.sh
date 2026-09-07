#!/usr/bin/env bash
# Zoen all-in-one: Postgres + RustFS (S3) + server on one Fly machine / volume.
# ZA-05: distinct bootstrap / DB / object-store / app identities on one profile.
# ZA-06: deterministic install lifecycle — same-release restart; digest mismatch
# refuses (RESET_REQUIRED); readiness env fixed; supervise PG/RustFS/app exits.
# module-resolution via /app/ops/node_modules -> apps/server/node_modules
set -euo pipefail

DATA_ROOT="${ZOEN_DATA_ROOT:-/data}"
PGDATA="${PGDATA:-${DATA_ROOT}/postgres}"
OBJECT_DATA="${ZOEN_OBJECT_DATA:-${DATA_ROOT}/object}"
ZOEN_STATE="${ZOEN_STATE_DIR:-${DATA_ROOT}/zoen}"
# Root-only parent (not under zoen-writable ZOEN_STATE) so the app cannot rename/replace secrets.
BOOTSTRAP_DIR="${ZOEN_BOOTSTRAP_DIR:-${DATA_ROOT}/bootstrap}"
PG_INFRA_PASSWORD_FILE="${BOOTSTRAP_DIR}/pg-infra.password"
RUSTFS_ACCESS_KEY_FILE="${BOOTSTRAP_DIR}/rustfs-access-key"
RUSTFS_SECRET_KEY_FILE="${BOOTSTRAP_DIR}/rustfs-secret-key"
export PATH="/usr/lib/postgresql/18/bin:${PATH}"

umask 077

mkdir -p "${PGDATA}" "${OBJECT_DATA}" "${ZOEN_STATE}" "${BOOTSTRAP_DIR}"
chown -R postgres:postgres "${PGDATA}"
chown root:root "${BOOTSTRAP_DIR}"
chmod 700 "${BOOTSTRAP_DIR}"
# ZOEN_STATE is root-owned (755): zoen can traverse/read group-readable files but cannot
# rename sibling /data/bootstrap or replace root-owned runtime files.
chown root:root "${ZOEN_STATE}"
chmod 755 "${ZOEN_STATE}"
# Drop any prior-boot supervisor marker so a healthy run cannot inherit status=1.
rm -f "${ZOEN_STATE}/supervisor-failure.txt"

write_secret_file() {
  local path="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp "${path}.tmp.XXXXXX")"
  printf '%s' "${value}" >"${tmp}"
  chown root:root "${tmp}"
  chmod 600 "${tmp}"
  mv -f "${tmp}" "${path}"
}

refuse_insecure_secret_file() {
  local path="$1"
  local owner mode
  if [[ ! -f "${path}" ]]; then
    echo "all-in-one: refusing non-file secret path ${path}" >&2
    exit 1
  fi
  owner="$(stat -c '%u' "${path}")"
  mode="$(stat -c '%a' "${path}")"
  if [[ "${owner}" != "0" ]]; then
    echo "all-in-one: refusing non-root-owned secret file ${path}" >&2
    exit 1
  fi
  # Allow only owner read/write (no group/other bits).
  if [[ "${mode}" != "600" && "${mode}" != "400" ]]; then
    chmod 600 "${path}"
    mode="$(stat -c '%a' "${path}")"
    if [[ "${mode}" != "600" && "${mode}" != "400" ]]; then
      echo "all-in-one: refusing secret file with insecure mode ${path}" >&2
      exit 1
    fi
  fi
}

ensure_secret_file() {
  local path="$1"
  local generator="$2"
  if [[ -e "${path}" ]]; then
    if [[ ! -s "${path}" ]]; then
      echo "all-in-one: refusing empty secret file ${path}" >&2
      exit 1
    fi
    refuse_insecure_secret_file "${path}"
    return 0
  fi
  write_secret_file "${path}" "$(eval "${generator}")"
}

validate_infra_password() {
  local pw="$1"
  if [[ -z "${pw}" ]]; then
    echo "all-in-one: empty infrastructure password" >&2
    exit 1
  fi
  # Bash cannot store NUL in variables ($'\0' is empty and would match every password).
  case "${pw}" in
    *$'\n'*|*$'\r'*)
      echo "all-in-one: infrastructure password contains control characters" >&2
      exit 1
      ;;
  esac
}

# URL-encode a password for postgresql:// without shell-evaluating it.
urlencode_password() {
  PASSWORD_VALUE="$1" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["PASSWORD_VALUE"], safe=""))'
}

# Emit a single-quoted SQL string literal with '' escaping (handles apostrophes safely).
sql_password_literal() {
  PASSWORD_VALUE="$1" python3 -c "import os; p=os.environ[\"PASSWORD_VALUE\"]; print(chr(39)+p.replace(chr(39), chr(39)*2)+chr(39))"
}

# Load KEY="value" runtime.env without `source` (no shell evaluation as root).
load_runtime_env_file() {
  local file="$1"
  local line key raw value
  if [[ ! -f "${file}" ]]; then
    echo "all-in-one: missing runtime.env ${file}" >&2
    exit 1
  fi
  while IFS= read -r line || [[ -n "${line}" ]]; do
    # Trim ASCII whitespace; blank lines are ignored (matches parseQuotedEnvFile).
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    if [[ -z "${line}" ]]; then
      continue
    fi
    if [[ "${line}" != *=* ]]; then
      echo "all-in-one: malformed runtime.env line (no =)" >&2
      exit 1
    fi
    key="${line%%=*}"
    raw="${line#*=}"
    if [[ ! "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "all-in-one: invalid runtime.env key" >&2
      exit 1
    fi
    if [[ "${#raw}" -lt 2 || "${raw:0:1}" != '"' || "${raw: -1}" != '"' ]]; then
      echo "all-in-one: runtime.env values must be double-quoted" >&2
      exit 1
    fi
    value="${raw:1:${#raw}-2}"
    case "${value}" in
      *$'\n'*|*$'\r'*|*\\*|*'\"'*)
        echo "all-in-one: unsupported runtime.env value encoding" >&2
        exit 1
        ;;
    esac
    printf -v "${key}" '%s' "${value}"
    export "${key}"
  done < "${file}"
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
  validate_infra_password "${ZOEN_PG_INFRA_PASSWORD}"
  write_secret_file "${PG_INFRA_PASSWORD_FILE}" "${ZOEN_PG_INFRA_PASSWORD}"
  unset ZOEN_PG_INFRA_PASSWORD
fi
ensure_secret_file "${PG_INFRA_PASSWORD_FILE}" 'openssl rand -hex 32'
PG_INFRA_PASSWORD="$(cat "${PG_INFRA_PASSWORD_FILE}")"
validate_infra_password "${PG_INFRA_PASSWORD}"

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

# Set/rotate infra password via a Python-escaped SQL literal file (apostrophes/URL chars OK).
set_infra_password() {
  local sqlfile sql
  sqlfile="$(mktemp /tmp/zoen-infra-pw.XXXXXX.sql)"
  sql="ALTER ROLE zoen_infra WITH LOGIN PASSWORD $(sql_password_literal "${PG_INFRA_PASSWORD}");"
  printf '%s\n' "${sql}" >"${sqlfile}"
  chown postgres:postgres "${sqlfile}"
  chmod 600 "${sqlfile}"
  if gosu postgres psql -h /tmp -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT 1" >/dev/null 2>&1; then
    gosu postgres psql -h /tmp -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
      -f "${sqlfile}" >/dev/null
    rm -f "${sqlfile}"
    return 0
  fi
  if gosu postgres psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT 1" >/dev/null 2>&1; then
    gosu postgres psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
      -f "${sqlfile}" >/dev/null
    rm -f "${sqlfile}"
    return 0
  fi
  gosu postgres env PGPASSWORD="${PG_INFRA_PASSWORD}" \
    psql -h 127.0.0.1 -U zoen_infra -d postgres -v ON_ERROR_STOP=1 \
    -f "${sqlfile}" >/dev/null
  rm -f "${sqlfile}"
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
  # ZA-06: env assignment must precede the command (trailing U= is argv, not env).
  if U="http://127.0.0.1:9000/health/ready" node --input-type=module -e \
    'const u=process.env.U; try { const r=await fetch(u); process.exit(r.ok?0:1);} catch { process.exit(1); }'; then
    break
  fi
  sleep 0.5
done
U="http://127.0.0.1:9000/health/ready" node --input-type=module -e \
  'const u=process.env.U; const r=await fetch(u); if(!r.ok) process.exit(1);'

# Bootstrap-only credentials (cleared before app start).
ZOEN_S3_ACCESS_KEY="$(cat "${RUSTFS_ACCESS_KEY_FILE}")"
ZOEN_S3_SECRET_KEY="$(cat "${RUSTFS_SECRET_KEY_FILE}")"
PG_INFRA_PASSWORD_URLENC="$(urlencode_password "${PG_INFRA_PASSWORD}")"
export ZOEN_BOOTSTRAP_ADMIN_URL="postgresql://zoen_infra:${PG_INFRA_PASSWORD_URLENC}@127.0.0.1:5432/postgres"
unset PG_INFRA_PASSWORD_URLENC
export ZOEN_S3_ACCESS_KEY ZOEN_S3_SECRET_KEY
export ZOEN_S3_ADMIN_ACCESS_KEY="${ZOEN_S3_ACCESS_KEY}"
export ZOEN_S3_ADMIN_SECRET_KEY="${ZOEN_S3_SECRET_KEY}"
export ZOEN_S3_ENDPOINT="${ZOEN_S3_ENDPOINT:-http://127.0.0.1:9000}"
export ZOEN_S3_REGION="${ZOEN_S3_REGION:-us-east-1}"
export ZOEN_S3_BUCKET="${ZOEN_S3_BUCKET:-zoen}"
export ZOEN_INSTALLATION_FILE="${ZOEN_INSTALLATION_FILE:-${ZOEN_STATE}/installation.json}"
export ZOEN_RUNTIME_ENV_FILE="${ZOEN_RUNTIME_ENV_FILE:-${ZOEN_STATE}/runtime.env}"
export ZOEN_WORLD_POLICY="${ZOEN_WORLD_POLICY:-worlds-hosted-retained-v1}"
export ZOEN_RELEASE_FILE="${ZOEN_RELEASE_FILE:-/app/apps/server/dist/release.json}"

echo "all-in-one: provisioning / migrating if needed"
export NODE_PATH="/app/apps/server/node_modules:/app/node_modules${NODE_PATH:+:$NODE_PATH}"
# Capture the Node status without `!` (negation would discard a nonzero exit).
if node /app/apps/server/scripts/all-in-one-bootstrap.ts; then
  :
else
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

# App-readable state files: root-owned, zoen-readable, not zoen-writable (cannot replace).
chown root:root "${BOOTSTRAP_DIR}"
chmod 700 "${BOOTSTRAP_DIR}"
chmod 600 "${PG_INFRA_PASSWORD_FILE}" "${RUSTFS_ACCESS_KEY_FILE}" "${RUSTFS_SECRET_KEY_FILE}"
for state_file in \
  "${ZOEN_RUNTIME_ENV_FILE}" \
  "${ZOEN_INSTALLATION_FILE}" \
  "${ZOEN_STATE}/.bootstrap-complete"; do
  if [[ -f "${state_file}" ]]; then
    chown root:zoen "${state_file}"
    chmod 640 "${state_file}"
  fi
done
# Optional bootstrap error log (root-only).
if [[ -f "${ZOEN_STATE}/bootstrap-error.txt" ]]; then
  chown root:root "${ZOEN_STATE}/bootstrap-error.txt"
  chmod 600 "${ZOEN_STATE}/bootstrap-error.txt"
fi
# Re-assert directory permissions (bootstrap mkdir must not leave 0700 blocking zoen reads).
chown root:root "${ZOEN_STATE}"
chmod 755 "${ZOEN_STATE}"

load_runtime_env_file "${ZOEN_RUNTIME_ENV_FILE}"

if [[ -n "${ZOEN_BOOTSTRAP_ADMIN_URL:-}" ]]; then
  echo "all-in-one: refusing to start app with ZOEN_BOOTSTRAP_ADMIN_URL present" >&2
  exit 1
fi
if [[ -n "${ZOEN_S3_ADMIN_ACCESS_KEY:-}" || -n "${ZOEN_S3_ADMIN_SECRET_KEY:-}" ]]; then
  echo "all-in-one: refusing to start app with ZOEN_S3_ADMIN_* present" >&2
  exit 1
fi

CLEANUP_DONE=0
cleanup() {
  if [[ "${CLEANUP_DONE}" -eq 1 ]]; then
    return 0
  fi
  CLEANUP_DONE=1
  echo "all-in-one: shutting down"
  if [[ -n "${MONITOR_PID:-}" ]]; then
    kill -TERM "${MONITOR_PID}" 2>/dev/null || true
    wait "${MONITOR_PID}" 2>/dev/null || true
    MONITOR_PID=""
  fi
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill -TERM "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
    SERVER_PID=""
  fi
  gosu postgres pg_ctl --pgdata="${PGDATA}" --mode=fast --wait stop 2>/dev/null || true
  if [[ -n "${RUSTFS_PID:-}" ]]; then
    kill -TERM "${RUSTFS_PID}" 2>/dev/null || true
    wait "${RUSTFS_PID}" 2>/dev/null || true
    RUSTFS_PID=""
  fi
}
trap cleanup TERM INT EXIT

# ZA-06-04: observe dependency exits after readiness; withdraw by stopping the app
# so Fly /ready fails closed. Retain a bounded local failure reason.
supervise_dependencies() {
  local reason=""
  while true; do
    if [[ -n "${RUSTFS_PID:-}" ]] && ! kill -0 "${RUSTFS_PID}" 2>/dev/null; then
      reason="RUSTFS_EXIT"
      break
    fi
    if ! gosu postgres pg_isready -h /tmp -d postgres >/dev/null 2>&1; then
      reason="POSTGRES_NOT_READY"
      break
    fi
    sleep 1
  done
  printf '%s\n' "${reason}" >"${ZOEN_STATE}/supervisor-failure.txt"
  chown root:root "${ZOEN_STATE}/supervisor-failure.txt" 2>/dev/null || true
  chmod 600 "${ZOEN_STATE}/supervisor-failure.txt" 2>/dev/null || true
  echo "all-in-one: dependency failure ${reason}; withdrawing readiness" >&2
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill -TERM "${SERVER_PID}" 2>/dev/null || true
  fi
}

echo "all-in-one: starting Zoen server on ${ZOEN_LISTEN_HOST:-0.0.0.0}:${ZOEN_PORT:-4310} as zoen"
gosu zoen env \
  -u RUSTFS_ACCESS_KEY_FILE \
  -u RUSTFS_SECRET_KEY_FILE \
  -u ZOEN_BOOTSTRAP_ADMIN_URL \
  -u ZOEN_S3_ADMIN_ACCESS_KEY \
  -u ZOEN_S3_ADMIN_SECRET_KEY \
  node /app/apps/server/dist/main.js &
SERVER_PID=$!
supervise_dependencies &
MONITOR_PID=$!
# Capture wait under set -e so dependency-driven nonzero exits still reach cleanup.
if wait "${SERVER_PID}"; then
  status=0
else
  status=$?
fi
SERVER_PID=""
if [[ -f "${ZOEN_STATE}/supervisor-failure.txt" ]]; then
  status=1
fi
# EXIT trap runs cleanup; clear MONITOR_PID so trap reaps it once.
exit "${status}"
