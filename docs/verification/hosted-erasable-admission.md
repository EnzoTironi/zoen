# Hosted erasable admission (ZA-14)

Date: **2026-09-08 (PT)**. Tip baseline: `23218ac` (ZA-13).

## Scope

Bind **one** exact new or explicitly recreated hosted target to `worlds-hosted-erasable-v1`. Every retained install (`worlds-hosted-retained-v1`, `worlds-local-retained-v1`), legacy Fly app `zoen`, and retained bucket name `zoen` stay **outside** that scope and are refused before purge/rebind/deletion.

## Product posture (fail-closed)

| Gate | Status | Notes |
| --- | --- | --- |
| H-01 | **Blocked** | No independent hosted controller footprint approved |
| H-02 | **Blocked** | No Enzo-authorized real hosted erasable target |
| G-OPS | **Unknown** | Live inventory not re-bound as erasable qualification |
| G-STORAGE-FENCE | **Blocked** | Object Lock ≠ writer fence |
| `fullHostedErased` | **false** | Capability stays disabled after this PR |
| `productAccepted` | **false** | Merge does not activate hosted Erased |
| `restoreAfterErasure` | **false** | Unchanged (ZA-13) |

Local **exact-image** disposable proof may exercise Closing → restore suppression under an explicitly authorized synthetic target. That is a prerequisite seam, **not** a substitute for remote destructive hosted proof (not authorized by this ticket).

## Proofs

| ID | Seam |
| --- | --- |
| ZA-14-01 | `tests/integration/hosted/erasable/admission.ZA14.integration.test.ts` — Closing + content suppress; gates stay Blocked/Unknown |
| ZA-14-02 | Retained install / legacy app / bucket-name reuse refused (`ops/fly/erasable-target.test.ts`, admission unit + integration) |
| ZA-14-03 | Controller unavailable / held object / incomplete catalog → Blocked/Unknown; Full hosted Erased unavailable |

## Out of scope

- Destroying Fly app `zoen`
- DNS cutover
- Reusing retained bucket `zoen` by name
- Remote destructive hosted steps
- Advertising Full hosted Erased as Qualified

## Related

- Object Lock re-probe (not Full Erased): [`erasure-fly-object-lock.md`](./erasure-fly-object-lock.md)
- Hosted retained admission: [`hosted-admission.md`](./hosted-admission.md)
