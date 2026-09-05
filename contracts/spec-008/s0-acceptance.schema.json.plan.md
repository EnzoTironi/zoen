# File plan — `contracts/spec-008/s0-acceptance.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-008/s0-acceptance.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-008](../../docs/specs/spec-008.md).
Tickets: [ZN-0051](../../docs/tickets/zn-0051.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-008
Health() -> Liveness; Readiness() -> AdmittedDependencies; ExportOperationalEvidence(scope) -> RedactedReport; RestoreAdmission(backupRef,deletionCut,effectLedger) -> ReadOnlyReady | Blocked.

audit.operational_events(event_id PK,world_ref_nullable,actor_ref,kind,redacted_payload,occurred_at,retention_class); jobs.recovery_fences(cell_id PK,epoch,dispatch_enabled,deletion_ledger_cut); infra migration manifest contains legacy source commit, row counts, rights mapping and unmatched records.

[algorithm SPEC-008](../../docs/algorithms/spec-008.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
