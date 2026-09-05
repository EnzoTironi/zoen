# SPEC-040 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-040](../specs/spec-040.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Operations and Product**. Module: `packages/ontology/src/operations`. Milestone: **S9**.

## Normative operation signatures

```text
ReserveUsage(world,resource,estimate) -> Reservation | QuotaExceeded; AdmitWorkload(profile,benchmarkReport) -> CapacityCertificate; RequestSupportAccess(scope,purpose) -> TimeBoundCase; ExportAudit(scope,destination) -> AuthorizedArtifact.
```

## State and transaction contract

ontology.quota_policies(policy_id PK,world_id,resource,limit,window,priority); jobs.usage_reservations(reservation_id PK,world_id,kind,estimate,actual,state); audit.support_sessions(session_id PK,operator,world_scope,purpose,approver,expires_at,state); audit.slo_reports(report_id PK,profile,workload_digest,window,metrics,evidence_ref). Billing ledger references provider entitlements, never raw card data.

## Shared algorithm

```text
RESOLVE current resource limits by World/principal/profile and reserve before costly work.
ACCOUNT for query rows/bytes, concurrency, model tokens, source egress, storage and effect ceilings independently.
SCHEDULE under declared fairness/priority; one tenant cannot consume unbounded queue or memory.
RECONCILE actual measured usage and bounded unknown costs without negative/double-released reservations.
BENCHMARK declared workload with real resources and exact rights selectivity; record distributions and failures.
ISSUE capacity certificate only from actual results bound to hardware/profile/commit; targets remain targets.
OPEN support metadata-only; content requires scoped purpose, independent approval, expiry and audit.
REVOKE support access and redact export evidence; no permanent global content superuser.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0231](../tickets/zn-0231.md) | Enforce per-World quotas and fair scheduling | [packages/ontology/src/operations/fairness.ts](../../packages/ontology/src/operations/fairness.ts) |
| [ZN-0232](../tickets/zn-0232.md) | Attribute usage and cost without inventing actuals | [packages/ontology/src/operations/usage-economics.ts](../../packages/ontology/src/operations/usage-economics.ts) |
| [ZN-0233](../tickets/zn-0233.md) | Implement time-bound audited support access | [packages/ontology/src/operations/support-access.ts](../../packages/ontology/src/operations/support-access.ts) |
| [ZN-0234](../tickets/zn-0234.md) | Implement security audit exports and incident runbooks | [packages/ontology/src/operations/audit-export.ts](../../packages/ontology/src/operations/audit-export.ts) |
| [ZN-0235](../tickets/zn-0235.md) | Benchmark full mixed workloads and serializable hotspots | [tests/performance/spec-040/capacity-benchmark.test.ts](../../tests/performance/spec-040/capacity-benchmark.test.ts) |
| [ZN-0236](../tickets/zn-0236.md) | Accept an institutional operating profile from measured evidence | [admissions/spec-040/operating-admission.json](../../admissions/spec-040/operating-admission.json.plan.md) |

## Required proof boundaries

Enforce concurrency, query rows/bytes, LLM tokens, source egress, storage and effect quotas before resource use. Reconcile actual usage after observation and bound unknown-cost exposure. Separate queues/fair scheduling by policy. Support starts metadata-only; content access requires explicit approval, expiry, reason and audit. No permanent global support superuser.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
