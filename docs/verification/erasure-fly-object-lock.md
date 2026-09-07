# Erasure storage — Fly all-in-one RustFS Object Lock re-probe

Date observed: **2026-09-07 (PT)** / probe UTC **2026-09-07T13:27:24Z–13:27:25Z**.
Live app: **`zoen-rebuild`** (machine `48e3626fd21e78`, region `gru`), public `/ready` → `{"status":"ready"}` on `https://zoen.tironi.xyz/ready`.
Topology: all-in-one Dockerfile — Postgres + **RustFS `1.0.0-rc.5`** (`git 40a2470…`) + Zoen server on volume `zoen_data` → `/data`. Object store is **loopback only** (`ZOEN_S3_ENDPOINT=http://127.0.0.1:9000`); not Tigris; not publicly exposed.

This report **re-probes Object Lock on the live Fly RustFS process**. It does **not** claim hosted Erased, independent controller, backup catalog, ER-R02, or `restoreAfterErasure`.

Raw sanitized transcripts (no secrets):

- [`ops/fly/evidence/object-lock-reprobe-20260907T132725Z.jsonl.txt`](../../ops/fly/evidence/object-lock-reprobe-20260907T132725Z.jsonl.txt)
- [`ops/fly/evidence/object-lock-existing-bucket-20260907T132810Z.txt`](../../ops/fly/evidence/object-lock-existing-bucket-20260907T132810Z.txt)

Local qualification remains [`erasure-storage-qualification.md`](./erasure-storage-qualification.md).

## How the probe ran

1. `fly ssh` into `zoen-rebuild` (operator already authenticated via `flyctl`).
2. Node `v24.20.0` + `@aws-sdk/client-s3` already present under `/app/apps/server/node_modules`.
3. Disposable UUID buckets only; credentials from machine env `ZOEN_S3_*` (Fly secrets — values never logged).
4. Probe script removed from the VM after the run.

## Results matrix

| Capability | API | Result | Notes |
| --- | --- | --- | --- |
| Install bucket `zoen` Object Lock | `GetObjectLockConfiguration` | **404** `ObjectLockConfigurationNotFoundError` | Expected: Worlds policy `d04-hosted-retained-v1` (erasure:false). Not migrated. |
| Versioning enable + list | `PutBucketVersioning`, `ListObjectVersions`, … | **PASS** | Disposable bucket |
| Object Lock at `CreateBucket` | `ObjectLockEnabledForBucket: true` | **PASS** | Get showed `Enabled` |
| Object Lock Put on existing bucket **without** versioning | `PutObjectLockConfiguration` | **OBSERVED 409** `InvalidBucketState` — *Object Lock configuration cannot be enabled on existing buckets* | Matches AWS create-time intuition when versioning is off |
| Object Lock Put on existing bucket **after** versioning Enabled | `PutBucketVersioning` then `PutObjectLockConfiguration` | **PASS** | Supplemental probe: status 200, Get `Enabled` |
| Retention put/get + enforce | `PutObjectRetention`, `GetObjectRetention`, `DeleteObject` | **PASS** (isolated lock bucket) | Delete without bypass → **403**; `BypassGovernanceRetention: true` → **204** (cleanup only — **not** product path) |
| Legal hold put/get + enforce | `PutObjectLegalHold`, … | **PASS** | Delete while ON → **403**; release OFF then delete OK |
| Multipart list/abort | … | **PASS** | Smoke |
| Physical media destruction | — | **Not proven** | DELETE/404 ≠ forensic wipe |
| Hosted Erased / D03 integral | — | **Still blocked** | Controller, backup catalog, ER-R02, `restoreAfterErasure`, retained install bucket |

## Consequences

1. **Fly RustFS Object Lock is qualified** for the same image/topology as local compose. The prior “Fly re-probe” gap on Object Lock APIs is **cleared**.
2. **Product provision rule stands:** erasable installs must create buckets with `ObjectLockEnabledForBucket: true` **and** versioning Enabled at provision time. Enabling lock later requires versioning first on this RustFS build; do not assume AWS create-time-only without checking versioning state.
3. **Live `zoen` install remains retained** (`d04-hosted-retained-v1`): no Object Lock on the production bucket. Hosted Erased still needs a **new** erasable World/install path plus the other D03 gates — not an in-place lock enable on retained data.
4. Product purge must still **fail closed** on Retention / LegalHold / Unknown — never set `BypassGovernanceRetention` on the product path.

## Still blocked (honest)

| Gate | Status |
| --- | --- |
| Fly Object Lock API re-probe | **Cleared** (this document) |
| Fly all-in-one independent controller / anti-rollback | **Blocked** — app PG + RustFS share one volume |
| Backup / copy catalog | **Blocked** |
| World fence + in-flight PUT/multipart (ER-R02) | **Blocked** |
| Hosted Closing→Erased on live install | **Blocked** — retained policy + gates above |
| `restoreAfterErasure` | **false** / closed (F04) |

## Reproduction

```bash
# From a machine with flyctl auth for zoen-rebuild:
fly ssh console -a zoen-rebuild -C 'rustfs --version'
# Upload a disposable probe under /app/apps/server/scripts/ (ESM resolves @aws-sdk),
# run with PROBE_OUT_DIR=/tmp/…, then delete the script.
# Do not print ZOEN_S3_* values.
curl -fsS https://zoen.tironi.xyz/ready
```
