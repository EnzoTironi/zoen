# SPEC-008 — Baseline observability, local operations and safe migration preparation

**Milestone:** S0 · **Owner:** Operations · **Root:** `packages/telemetry/src`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Operational visibility and recovery start with the first truthful outcome. Logs are not semantic receipts. Legacy data is never reset because a repository looks empty. A restore starts read-only with effects disabled.

## Owned state and storage contract
audit.operational_events(event_id PK,world_ref_nullable,actor_ref,kind,redacted_payload,occurred_at,retention_class); jobs.recovery_fences(cell_id PK,epoch,dispatch_enabled,deletion_ledger_cut); infra migration manifest contains legacy source commit, row counts, rights mapping and unmatched records.

## Operations

```text
Health() -> Liveness; Readiness() -> AdmittedDependencies; ExportOperationalEvidence(scope) -> RedactedReport; RestoreAdmission(backupRef,deletionCut,effectLedger) -> ReadOnlyReady | Blocked.
```

## Execution protocol
Attach request, World, commit, case and effect correlation IDs without recording raw documents, model prompts or hidden reasoning. Persist redaction policy tests. Backup evidence and authority coherently enough to detect unavailable objects; reconcile missing objects, never fabricate them. Disable outbound effects after restore until deletion and escaped-request reconciliation complete.

## Pseudocode and file ownership

[algorithm SPEC-008](../algorithms/spec-008.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0047](../tickets/zn-0047.md) | Implement structured telemetry and redaction | component | [ZN-0024](../tickets/zn-0024.md), [ZN-0046](../tickets/zn-0046.md) |
| [ZN-0048](../tickets/zn-0048.md) | Implement readiness, admission flags and graceful drain | component | [ZN-0047](../tickets/zn-0047.md) |
| [ZN-0049](../tickets/zn-0049.md) | Prove backup and restore in a disposable environment | chaos | [ZN-0048](../tickets/zn-0048.md) |
| [ZN-0050](../tickets/zn-0050.md) | Create non-destructive legacy import qualification | component | [ZN-0049](../tickets/zn-0049.md) |
| [ZN-0051](../tickets/zn-0051.md) | Accept the S0 truth-without-chat journey | journey | [ZN-0050](../tickets/zn-0050.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `security-and-operations.md`, `capacity-economics-and-slos.md`, `migration-and-adoption.md`. Read a named historical reference only when needed; it cannot override current contracts.
