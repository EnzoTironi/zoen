# SPEC-008 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-008](../specs/spec-008.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Operations**. Module: `packages/telemetry/src`. Milestone: **S0**.

## Normative operation signatures

```text
Health() -> Liveness; Readiness() -> AdmittedDependencies; ExportOperationalEvidence(scope) -> RedactedReport; RestoreAdmission(backupRef,deletionCut,effectLedger) -> ReadOnlyReady | Blocked.
```

## State and transaction contract

audit.operational_events(event_id PK,world_ref_nullable,actor_ref,kind,redacted_payload,occurred_at,retention_class); jobs.recovery_fences(cell_id PK,epoch,dispatch_enabled,deletion_ledger_cut); infra migration manifest contains legacy source commit, row counts, rights mapping and unmatched records.

## Shared algorithm

```text
EMIT correlation identifiers and bounded operational events; exclude credentials, documents, prompts and hidden reasoning.
DISTINGUISH liveness from readiness for actual admitted dependencies and enabled capabilities.
CAPTURE backup manifests covering authority cuts, object pins, deletion ledger references and escaped effects.
RESTORE into isolated read-only/dispatch-disabled infrastructure, never over a live unknown tenant.
REPLAY current deletion suppression before any user read; verify missing objects and role separation.
RECONCILE escaped external attempts using original identities; Unknown stays Unknown.
MEASURE recovery against the actual fixture/profile and publish commands plus observations, not assumed service guarantees.
ADMIT writes/dispatch only after current operator approval and failed checks are resolved.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0047](../tickets/zn-0047.md) | Implement structured telemetry and redaction | [packages/telemetry/src/redaction.ts](../../packages/telemetry/src/redaction.ts) |
| [ZN-0048](../tickets/zn-0048.md) | Implement readiness, admission flags and graceful drain | [packages/telemetry/src/readiness.ts](../../packages/telemetry/src/readiness.ts) |
| [ZN-0049](../tickets/zn-0049.md) | Prove backup and restore in a disposable environment | [tests/chaos/spec-008/restore-baseline.test.ts](../../tests/chaos/spec-008/restore-baseline.test.ts) |
| [ZN-0050](../tickets/zn-0050.md) | Create non-destructive legacy import qualification | [packages/telemetry/src/legacy-import.ts](../../packages/telemetry/src/legacy-import.ts) |
| [ZN-0051](../tickets/zn-0051.md) | Accept the S0 truth-without-chat journey | [tests/journey/spec-008/s0-acceptance.test.ts](../../tests/journey/spec-008/s0-acceptance.test.ts) |

## Required proof boundaries

Attach request, World, commit, case and effect correlation IDs without recording raw documents, model prompts or hidden reasoning. Persist redaction policy tests. Backup evidence and authority coherently enough to detect unavailable objects; reconcile missing objects, never fabricate them. Disable outbound effects after restore until deletion and escaped-request reconciliation complete.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
