# Development

## Trunk-based flow

Trunk is `main`. Prefer short-lived PRs against `main`. Protect main already requires the Verify workflow job named `required`.

Merge to `main` is the path to production: continuous deploy targets the Fly app `zoen-rebuild` ([https://zoen.tironi.xyz](https://zoen.tironi.xyz)). That is separate from local work.

There is **no** paid Fly staging environment — no extra Fly apps, machines, MPG, or Tigris for staging.

## Local staging

Staging is a disposable stack developers and agents spin up on demand:

1. Docker Compose (`ops/compose.yaml`) — Postgres + object storage
2. `pnpm provision:local` with an isolated profile
3. `pnpm start:server` against that profile

Cost is laptop Docker only.

### Profile

Scripts use `ZOEN_LOCAL_PROFILE=staging`. That creates `.env.staging` and `.local/staging/` with their own database, roles, and bucket. It does **not** overwrite the default `application` profile.

Compose itself is shared (one Postgres / object-storage project named `zoen-rebuild`). Profiles isolate installs inside that project via per-profile database, roles, bucket, and a `resources.json` ownership inventory. Default `staging:reset` removes only that inventory — never shared Compose volumes.

### Commands

```bash
pnpm install --frozen-lockfile
pnpm build

pnpm staging:up
ZOEN_LOCAL_PROFILE=staging pnpm start:server
```

Open `http://127.0.0.1:4310` and create a normal account.

| Script | Behavior |
| --- | --- |
| `pnpm staging:up` | Create `.env.infra` if missing, `compose up -d --wait`, provision `staging` if `.env.staging` is absent; refuses incomplete/stale staging pointers |
| `pnpm staging:down` | `compose down` — keeps volumes and profile files |
| `pnpm staging:reset` | Drop **only** the staging profile's owned database/roles/bucket and remove `.env.staging` + `.local/staging`. Shared Compose volumes and other profiles (e.g. `application`) stay intact. Refuses symlinks, hosted URLs, and missing/foreign ownership inventory. |
| `pnpm staging:logs` | Follow compose logs |

After `staging:down`, bring the same install back with `pnpm staging:up` (reuses a complete `.env.staging` + ownership inventory) then start the server. After `staging:reset`, `staging:up` provisions a fresh staging install.

Whole-infrastructure wipe (`compose down --volumes`) is **not** the staging default. It requires an explicit opt-in that enumerates affected local profiles:

```bash
python3 tooling/staging_reset.py --wipe-shared-volumes --i-accept-removing-all-local-profiles
```

### Pre-merge / agent verify

Use local staging before merge when you need a real server against disposable infra. Do not point these scripts at production Fly, and do not create a Fly staging app.

Acceptance against the local server (same pattern as the README):

```bash
ZOEN_LOCAL_PROFILE=staging \
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_CSV_WEB_URL=http://127.0.0.1:4310 \
ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance
```

### What not to commit

`.env*`, `.local/`, Fly secrets, and tokens stay off git (see `.gitignore` and `SECURITY.md` when present).

## All-in-one install lifecycle (ZA-06)

Local and Fly all-in-one images pin `installation.releaseDigest` to the first-boot `release.json`.

| State | Meaning | Operator action |
| --- | --- | --- |
| Ready (same digest) | Marker + installation + runtime.env consistent with the running image | Restart is safe; World/policy/receipt identities are preserved |
| Incomplete | First install interrupted before `.bootstrap-complete` | Restart resumes; credentials are rewritten to match roles. No silent success with half-written state |
| Reset-required | Image `release.json` digest ≠ volume installation **and** tip upgrade not admitted | **Refuse** before serving. No automatic wipe, rebind, or silent digest rewrite |
| Tip upgrade (admitted) | Digest mismatch **with** `ZOEN_ADMIT_HOSTED_RELEASE_UPGRADE=true` | Controlled upgrade: ZA-08 schema migrate **then** rewrite `installation.releaseDigest` + `authority.worlds.release_digest`. Cell/generation preserved. Not a volume wipe |

### Local / CI disposable reset

Isolated Docker named volumes used by `pnpm test:container:identity` / `pnpm test:container:lifecycle` are disposable: remove the volume (`docker volume rm …`) and boot again. Staging profile reset remains `pnpm staging:reset` (owned inventory only).

### Hosted (`zoen-rebuild`) tip continuous deploy

ZA-06 still refuses digest mismatch by default (no silent rewrite). Continuous tip deploy to `zoen-rebuild` sets `ZOEN_ADMIT_HOSTED_RELEASE_UPGRADE=true` in `ops/fly/fly.toml` under Pre-launch Evolution (`AGENTS.md`): that is the **explicit** admission for ordinary tip image rolls.

Upgrade order is fixed: schema migrate (ZA-08 / #92) runs **before** digest rewrite. Same-release restarts still admit digest first, then migrate.

Admission is directional and durable on the volume (`.hosted-release-upgrade.json`):

- Before migrate, bootstrap records an upgrade-in-progress target; only that image may continue until installation rewrite succeeds.
- Digests that have successfully owned the volume are recorded; redeploying an older completed digest with the flag set is `RESET_REQUIRED` (no older image onto a newer schema).

Without that env (or after it is removed for production durability), operators must roll back to the last matching image or perform an explicitly authorized volume replace — do not edit digests by hand on a live volume.

## Pre-launch wire and development baseline (ZA-03)

Active wire and install identifiers use descriptive contract versions (not delivery numbers). Coordinated one-to-one mapping:

| Old (delivery) | New (descriptive) |
| --- | --- |
| `POST /api/d03/sharing` | `POST /api/sharing/execute` |
| `d03.sharing.v1` | `sharing.v1` |
| `d03-local-erasable-v1` | `worlds-local-erasable-v1` |
| `d04-hosted-retained-v1` | `worlds-hosted-retained-v1` |
| SQL baseline `001_d01_authority` / `002_d01_identity` | `001_authority` / `002_identity` |
| Object inventory dual-read `d01/` + `worlds/` | Canonical `worlds/` only |

Already descriptive and unchanged: `worlds-local-retained-v1`. Frozen legacy EX25 harness still admits `d01-local-retained-v1` against the pre-identity executable only; migration `011` continues to rewrite that stored id on current installs. Migration `013` one-shot rewrites `d03-local-erasable-v1` / `d04-hosted-retained-v1` World rows to the descriptive ids; hosted bootstrap/align atomically rewrites the same known literals in `installation.json` and fails closed on unknown policy ids.

**No shims / dual-read / dual-write.** Old routes and schema literals are rejected at product decode; known pre-launch delivery policy ids are rewritten once on migrate/bootstrap, not dual-read forever.

**Local reset:** disposable profile installs that applied the previous migrator ids or policy literals must be recreated (`pnpm staging:reset` for owned staging inventory, or an equivalent explicit disposable wipe). Do not edit already-applied migration bytes in place and keep using the same DB. Hosted / unlisted / foreign profiles remain refused by reset and provision tooling (ZA-04 ownership inventory); persistent hosted volumes rely on the one-shot policy rewrite above instead of wipe.
