# File plan — `admissions/spec-040/operating-admission.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-040/operating-admission.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-040](../../docs/specs/spec-040.md).
Tickets: [ZN-0236](../../docs/tickets/zn-0236.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0236 /* planning label, not a public API */
  OWNER := SPEC-040; TARGET := admissions/spec-040/operating-admission.json
  REQUIRE accepted dependencies: ZN-0235
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    RESOLVE current resource limits by World/principal/profile and reserve before costly work.
    ACCOUNT for query rows/bytes, concurrency, model tokens, source egress, storage and effect ceilings independently.
    SCHEDULE under declared fairness/priority; one tenant cannot consume unbounded queue or memory.
    RECONCILE actual measured usage and bounded unknown costs without negative/double-released reservations.
    BENCHMARK declared workload with real resources and exact rights selectivity; record distributions and failures.
    ISSUE capacity certificate only from actual results bound to hardware/profile/commit; targets remain targets.
    OPEN support metadata-only; content requires scoped purpose, independent approval, expiry and audit.
    REVOKE support access and redact export evidence; no permanent global content superuser.
  TICKET-SPECIFIC SEGMENT:
    01. Require capacity, security, disaster-recovery, support and on-call evidence for exact deployment/workload.
    02. Set SLOs and contractual limits only within the measured envelope.
    03. Keep unsupported scale/region/workload combinations unadmitted.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A customer workload exceeds the tested concurrency/data-skew profile
    WHEN Production expansion is requested
    THEN The expansion is blocked pending qualification; a Fortune 500 label does not waive the test
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
