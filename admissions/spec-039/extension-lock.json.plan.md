# File plan — `admissions/spec-039/extension-lock.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-039/extension-lock.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-039](../../docs/specs/spec-039.md).
Tickets: [ZN-0227](../../docs/tickets/zn-0227.md).

## Responsibility and reuse

```text
EVIDENCE-REQUIRES-EXECUTION — deliberately no fabricated target artifact.
RUN the actual registry/package-manager/provider/infrastructure qualification for this ticket.
RECORD observed identities, exact versions/integrity, supported API/profile, commands and failed or blocked results.
REQUIRE independent approval and current expiry/scope where applicable.
ONLY produce a lock using the real package manager; only produce a certificate from actual evidence.
NEVER rename this plan into a passing report.
```

## Owning state / operation contracts

### SPEC-039
ProvisionCell(profile,region,lock) -> StagedCell; AdmitCell(evidence) -> ActiveCell; RestoreCell(backup,ledger,profile) -> ReadOnlyCell; OpenPrivateConnector(profile) -> ScopedRoute.

Infrastructure state describes account/region/cell, authority database, object namespaces, KMS keys, private endpoints, workload identities, backup policy and admitted image digests. control.cells(cell_id PK,region,profile,epoch,admission_ref,state); audit.recovery_runs(run_id PK,cell_id,backup_ref,measured_rpo,measured_rto,evidence_ref). Customer content stays out of the directory/control plane.

[algorithm SPEC-039](../../docs/algorithms/spec-039.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
