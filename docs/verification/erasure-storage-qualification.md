# Erasure storage qualification — RustFS (local compose + topology note)

Date observed: **2026-09-07 (PT)**. Topology under test: Docker Compose `zoen-rebuild-object-storage-1` (`rustfs/rustfs:1.0.0-rc.5`), endpoint from `.env.infra` (`127.0.0.1:59004`). Hosting production candidate is Fly all-in-one `zoen-rebuild` with **the same RustFS image on a volume** (NOT Tigris). This report qualifies the **local RustFS process**. Live Fly Object Lock re-probe: [`erasure-fly-object-lock.md`](./erasure-fly-object-lock.md).

Prior versioning/multipart feasibility: [`erasure-s3-feasibility.md`](./erasure-s3-feasibility.md). This document adds **Object Lock / retention / legal hold** and states what the purge ports may rely on.

## Environment (no secrets)

| Item | Observation |
| --- | --- |
| Container | `zoen-rebuild-object-storage-1` (already healthy; not reconfigured) |
| Binary | `rustfs 1.0.0-rc.5` (build `2026-09-01 23:05:52 +00:00`, release, `linux-x86_64`) |
| Client | Node `v24.20.0`, `@aws-sdk/client-s3` **3.1127.0**, path-style, `maxAttempts:1` |
| Credentials | Compose bootstrap keys from `.env.infra` (values not recorded) |
| Data | Synthetic keys/bodies only; UUID buckets created and cleaned by the probe |

Probe artifacts (gitignored under `.local/`): `.local/erasure-storage-qualification/probe-object-lock.mjs` and console JSONL.

## Results matrix

| Capability | API | Result | Notes |
| --- | --- | --- | --- |
| Versioning enable + list | `PutBucketVersioning`, `GetBucketVersioning`, `ListObjectVersions`, `PutObject`, `DeleteObject` | **PASS** | Versions + delete markers listed; pagination cursors advance |
| Object Lock config absent by default | `GetObjectLockConfiguration` on ordinary bucket | **OBSERVED 404** `ObjectLockConfigurationNotFoundError` | Expected before enable |
| Object Lock enable on existing bucket | `PutObjectLockConfiguration` (GOVERNANCE default 1 day) | **PASS** | RustFS accepted Put+Get `Enabled` (AWS often requires create-time only — do not assume AWS parity) |
| Object Lock at CreateBucket | `CreateBucket` + `ObjectLockEnabledForBucket: true` | **PASS** | Subsequent Get showed `Enabled` |
| Retention put/get + enforce | `PutObjectRetention`, `GetObjectRetention`, `DeleteObject` | **PASS** (isolated lock bucket) | Delete without bypass → **403 AccessDenied**; with `BypassGovernanceRetention: true` → **204** (cleanup only) |
| Legal hold put/get + enforce | `PutObjectLegalHold`, `GetObjectLegalHold`, `DeleteObject` | **PASS** | Delete while ON → **403** (“legal hold… Remove the legal hold first”) |
| Multipart list/abort | `CreateMultipartUpload`, `UploadPart`, `ListMultipartUploads`, `AbortMultipartUpload` | **PASS** | Smoke only; aligns with prior feasibility |
| Physical media destruction | — | **Not proven** | DELETE/404 ≠ forensic wipe |
| Replication / lifecycle / MFA Delete | — | **Not exercised** | Still open |
| Live Fly VM RustFS Object Lock | — | **PASS (re-probed)** | See [`erasure-fly-object-lock.md`](./erasure-fly-object-lock.md) (2026-09-07). Hosted Erased still blocked on other gates. |

### Isolated retention transcript (sanitized)

```text
put status=200 version=<uuid>
retention-put status=200
retention-get status=200 mode=GOVERNANCE
delete-without-bypass blocked status=403 AccessDenied
delete-with-bypass status=204
bucket-deleted
```

## Consequences for purge ports

1. **Inventory** via `ListObjectVersions` (both cursors, no delimiter) is admissible for disposable local proofs.
2. **Explicit VersionId deletes** work; delete markers are distinct entries. Literal `"null"` remains a distinct id when present (prior feasibility).
3. **Holds are enforceable** on Object-Lock-enabled buckets: product purge must **fail closed** (`Blocked`) on Retention / LegalHold / Unknown — **never** set `BypassGovernanceRetention` on the product path.
4. **Minimum storage change for erasable installs:** create the install bucket with `ObjectLockEnabledForBucket: true` **and** versioning Enabled at provision time (`ops/local/provision.ts` for `d03-local-erasable-v1`). Retained installs stay without Object Lock (no dual-mode on one bucket). Existing retained buckets are not migrated.
5. **`EvidenceObjectStore.remove` remains unsuitable** for purge (collapses `"null"` / omits VersionId). New ports: `ErasureObjectInventory` + `ErasurePurgeStore` under `erasure/**`.

## Still blocked (honest)

| Gate | Status |
| --- | --- |
| Fly all-in-one independent controller / anti-rollback anchor | **Blocked** — app PG + RustFS share one Fly volume; local disposable register (EX31) ≠ qualified controller |
| Backup / copy catalog | **Blocked** |
| World fence (SQL/disclosure) | **Cleared ZA-09** |
| In-flight PUT/multipart admission/settlement (ZA-10) | **Boundary landed; G-STORAGE-FENCE Blocked** — see [`erasure-object-writer-containment.md`](./erasure-object-writer-containment.md) |
| SQL content purge + Closing→Erased attestation | **Local EX45 landed** (`local-controlled-copies` only); full D03 still blocked |
| `restoreAfterErasure` | **false** / closed (F04) |
| Fly Object Lock API re-probe | **Cleared** — [`erasure-fly-object-lock.md`](./erasure-fly-object-lock.md) |
| Hosted Erased on live Fly | **Blocked** — retained install + controller/backup/ER-R02/`restoreAfterErasure` |

## Reproduction

```bash
# From repo root with compose object-storage healthy and .env.infra present:
node --env-file=.env.infra .local/erasure-storage-qualification/probe-object-lock.mjs
# Integration:
pnpm exec vitest run --project integration apps/server/test/adapters/object-storage/erasure/purge.EX44.integration.test.ts
```

Do not print secrets or full SDK error payloads into git.
