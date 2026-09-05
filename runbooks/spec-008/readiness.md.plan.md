# File plan — `runbooks/spec-008/readiness.md`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `runbooks/spec-008/readiness.md`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-008](../../docs/specs/spec-008.md).
Tickets: [ZN-0048](../../docs/tickets/zn-0048.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

## ZN-0048 operational/repair procedure

Scope: Implement readiness, admission flags and graceful drain. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Readiness and capability discovery are queried
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
EMIT correlation identifiers and bounded operational events; exclude credentials, documents, prompts and hidden reasoning.
DISTINGUISH liveness from readiness for actual admitted dependencies and enabled capabilities.
CAPTURE backup manifests covering authority cuts, object pins, deletion ledger references and escaped effects.
RESTORE into isolated read-only/dispatch-disabled infrastructure, never over a live unknown tenant.
REPLAY current deletion suppression before any user read; verify missing objects and role separation.
RECONCILE escaped external attempts using original identities; Unknown stays Unknown.
MEASURE recovery against the actual fixture/profile and publish commands plus observations, not assumed service guarantees.
ADMIT writes/dispatch only after current operator approval and failed checks are resolved.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The core path remains usable and effects are explicitly unavailable; graceful shutdown creates no duplicate semantic result
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-008
Health() -> Liveness; Readiness() -> AdmittedDependencies; ExportOperationalEvidence(scope) -> RedactedReport; RestoreAdmission(backupRef,deletionCut,effectLedger) -> ReadOnlyReady | Blocked.

audit.operational_events(event_id PK,world_ref_nullable,actor_ref,kind,redacted_payload,occurred_at,retention_class); jobs.recovery_fences(cell_id PK,epoch,dispatch_enabled,deletion_ledger_cut); infra migration manifest contains legacy source commit, row counts, rights mapping and unmatched records.

[algorithm SPEC-008](../../docs/algorithms/spec-008.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
