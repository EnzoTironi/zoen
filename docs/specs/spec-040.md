# SPEC-040 — Fairness, economics, capacity admission and audited support

**Milestone:** S9 · **Owner:** Operations and Product · **Root:** `packages/ontology/src/operations`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Capacity is admitted against a reproducible workload envelope, not inferred from tenant count. Per-World fairness, resource budgets and audit-safe support are part of the product. Targets in this execution pack are proposed admission criteria, not measured promises.

## Owned state and storage contract
ontology.quota_policies(policy_id PK,world_id,resource,limit,window,priority); jobs.usage_reservations(reservation_id PK,world_id,kind,estimate,actual,state); audit.support_sessions(session_id PK,operator,world_scope,purpose,approver,expires_at,state); audit.slo_reports(report_id PK,profile,workload_digest,window,metrics,evidence_ref). Billing ledger references provider entitlements, never raw card data.

## Operations

```text
ReserveUsage(world,resource,estimate) -> Reservation | QuotaExceeded; AdmitWorkload(profile,benchmarkReport) -> CapacityCertificate; RequestSupportAccess(scope,purpose) -> TimeBoundCase; ExportAudit(scope,destination) -> AuthorizedArtifact.
```

## Execution protocol
Enforce concurrency, query rows/bytes, LLM tokens, source egress, storage and effect quotas before resource use. Reconcile actual usage after observation and bound unknown-cost exposure. Separate queues/fair scheduling by policy. Support starts metadata-only; content access requires explicit approval, expiry, reason and audit. No permanent global support superuser.

## Pseudocode and file ownership

[algorithm SPEC-040](../algorithms/spec-040.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0231](../tickets/zn-0231.md) | Enforce per-World quotas and fair scheduling | component | [ZN-0146](../tickets/zn-0146.md), [ZN-0152](../tickets/zn-0152.md), [ZN-0200](../tickets/zn-0200.md), [ZN-0229](../tickets/zn-0229.md) |
| [ZN-0232](../tickets/zn-0232.md) | Attribute usage and cost without inventing actuals | component | [ZN-0231](../tickets/zn-0231.md) |
| [ZN-0233](../tickets/zn-0233.md) | Implement time-bound audited support access | component | [ZN-0232](../tickets/zn-0232.md) |
| [ZN-0234](../tickets/zn-0234.md) | Implement security audit exports and incident runbooks | component | [ZN-0233](../tickets/zn-0233.md) |
| [ZN-0235](../tickets/zn-0235.md) | Benchmark full mixed workloads and serializable hotspots | performance | [ZN-0234](../tickets/zn-0234.md) |
| [ZN-0236](../tickets/zn-0236.md) | Accept an institutional operating profile from measured evidence | admission | [ZN-0235](../tickets/zn-0235.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `capacity-economics-and-slos.md`, `security-and-operations.md`. Read a named historical reference only when needed; it cannot override current contracts.
