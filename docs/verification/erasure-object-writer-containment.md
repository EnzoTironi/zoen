# Erasure object-writer containment — ZA-10 / G-STORAGE-FENCE

Date observed: **2026-09-08 (PT)**. Tip base: `origin/main` @ `eabb17a7` (ZA-09 merged). Topology: local RustFS `1.0.0-rc.5` via compose (same image class as Fly loopback). This report qualifies the **admission/settlement boundary** and states the honest G-STORAGE-FENCE status. It does **not** claim hosted Erased, credential retirement, or forensic wipe.

## Problem restated

A late PUT or multipart completion can recreate content after listing/deletion. AbortSignal, HEAD 404, TTL, and client cancellation are **not** exclusion proofs.

## What this PR implements

| Mechanism | Status |
| --- | --- |
| Durable `jobs.object_write_attempts` registration before external send | **Implemented** |
| `external_submitted` → `terminal_observed` \| sticky `unknown` | **Implemented** |
| Refuse HEAD 404 / TTL / network / credential-retirement as settlement | **Implemented (fail-closed)** |
| `requireSettledExternalWriters` before purge completion (captures + ledger + multipart) | **Implemented** |
| `ListMultipartUploads` inventory on the shipped erasure adapter | **Implemented** |
| Legal hold / retention → `Blocked` without `BypassGovernanceRetention` | **Preserved (EX44)** |
| Provider containment of in-flight PUT / old-credential Deny | **Not proven** |

## G-STORAGE-FENCE

| Item | Result |
| --- | --- |
| Purpose | Prove the selected object-IO writer containment boundary |
| Required | Actual RustFS/adapter behavior for late PUT/multipart, credential scope, cancellation uncertainty, durable terminal or independently enforced containment |
| Does not allow | Concluding no future object from HEAD 404, repeated list, client abort, TTL, or DB disconnect |
| **Qualification** | **`Blocked` / Unknown** — Object Lock proves hold enforcement on versions, **not** a writer fence. No admitted credential-retirement or Deny-Put boundary on the selected profile. Capability stays disabled; do not fake Qualified. |

Object Lock re-probe evidence remains [`erasure-fly-object-lock.md`](./erasure-fly-object-lock.md) and [`erasure-storage-qualification.md`](./erasure-storage-qualification.md). Those clear hold/version APIs only.

## Acceptance scenarios exercised

| ID | Scenario | Observed |
| --- | --- | --- |
| `ZA-10-01` | PUT admitted/submitted before Closing, reply delayed | Purge completion `UNAVAILABLE` while `external_submitted`; attempt remains governed |
| `ZA-10-02` | HEAD 404 or client cancellation | Settlement evidence `PROFILE_BLOCKED` / sticky `unknown`; cannot reach Erased |
| `ZA-10-03` | Old credential retirement claim | Absent proof → `PROFILE_BLOCKED`; fence stays closed |
| `ZA-10-04` | Legal hold or unknown multipart | Multipart listed; hold → `Blocked` purge outcome; no elevated delete on product path |

## Still blocked (honest)

- Full D03 / hosted Erased
- Independent controller / anti-rollback
- Backup / copy catalog
- `restoreAfterErasure`
- G-STORAGE-FENCE Qualified (late-PUT containment / credential retirement)

## Reproduction

```bash
pnpm exec vitest run --project unit packages/authority/src/knowledge/erasure/object-write-settlement.test.ts
pnpm exec vitest run --project integration \
  tests/integration/erasure/core/object-writer-containment.ZA10.integration.test.ts \
  apps/server/test/adapters/object-storage/erasure/writer-containment.ZA10.integration.test.ts
```

Do not print secrets or full SDK error payloads into git.
