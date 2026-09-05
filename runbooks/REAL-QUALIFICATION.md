# Real dependency qualification runbook

**Status: authored, not executed in the delivery environment. Use dedicated disposable resources only.**

The tests create users, Worlds, sources, claims, Frames, S3 objects and versions; manipulate test memberships; terminate a PostgreSQL connection; and lease queue rows. They are not safe for a production or shared cluster. No automatic destructive teardown is provided. Actual AWS usage may incur charges.

## 1. Establish the target

Admit Node 24, the exact pnpm/compiler/library versions and a real dependency lock per `docs/implementation-status.md`. Keep the Git worktree and tested commit identifiable. Run a complete `pnpm build` before any service test.

Install/run **real PostgreSQL 18** in a dedicated local or isolated test cluster. A real PostgreSQL container is acceptable after admitting its image digest; SQLite, in-memory Postgres emulation and protocol fakes are not. Create a fresh database named `zoen_test_<unique_suffix>`. Record the server minor/image identity. Use a dedicated test administrator for migration and intentional connection-termination tests.

PostgreSQL roles are cluster-global. The provisioning script refuses an existing `zoen_authority`, `zoen_door` or `zoen_outbox` name rather than change credentials belonging to another installation. Use a fresh dedicated cluster, or independently inspect/qualify existing roles without rerunning provisioning. The runtime must never use the administrator connection.

## 2. Provision real object storage

Create an actual AWS S3 bucket named `zoen-test-<unique_suffix>` in the intended test region/account. Enable versioning; enable all four public-access-block settings; keep ACLs/policies private. Verify bucket owner and region. Supply a least-privilege AWS profile/workload identity. Do not use MinIO, LocalStack, custom S3 endpoints or fake responses.

The adapter needs bucket versioning/public-access-block reads and object put/head/get-version for the test bucket and its generated keys. The qualification identity should not have unrelated account-wide resource access. The runtime does not require object deletion for this test suite. Record the actual policy and admitted transport/encryption configuration. Do not log credentials.

Versioning alone is not immutable retention against an administrator. Object Lock, retention, erasure/hold compatibility, restore and lifecycle policies are separate unimplemented qualification work; do not infer them from an exact-version round trip.

## 3. Configure local secrets

Copy `.env.example` to ignored `.env` and use restrictive permissions (`chmod 600 .env`). Generate three distinct random runtime role passwords and a separate random Better Auth secret of at least 32 characters. URL-encode passwords when composing PostgreSQL URLs; dotenv quoting is separate from URL escaping.

Required settings:

- `ZOEN_PUBLIC_ORIGIN=http://127.0.0.1:3080`, `ZOEN_PORT=3080`.
- `ZOEN_MIGRATOR_DATABASE_URL`: dedicated PostgreSQL test administrator on the disposable DB.
- `ZOEN_AUTHORITY_DATABASE_URL`, `ZOEN_DOOR_DATABASE_URL`, `ZOEN_OUTBOX_DATABASE_URL`: same disposable DB, respectively users `zoen_authority`, `zoen_door`, `zoen_outbox` with distinct passwords.
- `ZOEN_AUTHORITY_PASSWORD`, `ZOEN_DOOR_PASSWORD`, `ZOEN_OUTBOX_PASSWORD`: matching values for first-time role provisioning.
- `AWS_REGION`, `ZOEN_EVIDENCE_BUCKET`, `ZOEN_BUCKET_OWNER` (actual 12-digit owner account), `AWS_PROFILE` or admitted workload identity.
- `BETTER_AUTH_SECRET` and `ZOEN_REAL_TEST_CONSENT=disposable-resources-only`.

Never supply real consumer/enterprise/financial data. Test record values are synthetic; the infrastructure/auth/policy/storage implementations are real. Do not set forbidden `OFFLINE_MODE`, `MOCK_MODE`, `SKIP_AUTH`, `DEV_USER`, `FAKE_PROVIDER` or AWS endpoint-override environment variables.

The current edge binds IPv4 loopback. Use the explicit `127.0.0.1` origin to avoid hostname/IPv6 ambiguity. HTTP is limited to loopback; hosted HTTPS/TLS deployment is not qualified.

## 4. Migrate and provision, explicitly

Review the SQL files and target database. Set `ZOEN_ALLOW_SCHEMA_MIGRATIONS=yes` and `ZOEN_ALLOW_ROLE_PROVISIONING=yes` only for the reviewed initialization. Then:

```sh
node --env-file=.env tooling/migrate.mjs
node --env-file=.env tooling/provision.mjs
```

Remove those two permissions after initialization. Migration uses a checksum ledger and refuses untracked occupied application tables. There is no automatic reset/down migration. Role provisioning is a one-time operation on a fresh cluster, not a password rotation utility.

Verify the Better Auth schema matches the admitted version and that no extra plugin tables were silently enabled. Inspect actual grants and RLS before exposing the service even locally.

## 5. Run genuine tests

```sh
pnpm build
node --env-file=.env tooling/preflight.mjs --real
node --env-file=.env tooling/real-tests.mjs
node --env-file=.env tooling/verify.mjs
```

Preflight is necessary, not sufficient: configuration cannot prove service identity, permissions, connectivity or migrations. The real suite performs actual requests and fails on unavailable/misconfigured services. Missing resources produce a blocked report with zero execution. No `skip` fallback is accepted.

Do not run `pnpm start` concurrently on the same port while the real suite owns its server. After tests, a separate local start is `node --env-file=.env dist/apps/edge/src/main.js`. The process is an API candidate, not a shipped web UI or conversational product.

## 6. Capture and review

Save the source commit, lockfile, Node/compiler/package versions, PostgreSQL version, schema checksums, cloud profile (without secrets), raw TAP and failure output. Review all ten tests and supplement them with each relevant v4 check before accepting tickets. These tests do not include the full post-commit acknowledgement-loss, backup/restore, browser, scale, long-lived revocation or provider-effect matrix.

After review, an operator may remove only the recorded disposable database/cluster and bucket/versions. Confirm resource identifiers again and follow retention settings. No automatic cleanup script can assume an S3 prefix or database name proves a resource is expendable.
