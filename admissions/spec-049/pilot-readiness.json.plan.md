# File plan — `admissions/spec-049/pilot-readiness.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-049/pilot-readiness.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-049](../../docs/specs/spec-049.md).
Tickets: [ZN-0290](../../docs/tickets/zn-0290.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0290 /* planning label, not a public API */
  OWNER := SPEC-049; TARGET := admissions/spec-049/pilot-readiness.json
  REQUIRE accepted dependencies: ZN-0289
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    PROVISION the actual admitted shared profile with separate edge/Eve/authority identities and private storage.
    SERVE only qualified core/web/file capabilities initially; channel/model/effect/runtime gates are independent.
    KEEP identity, authority, evidence, erasure and idempotency identical to larger cells.
    ADMIT owner-only continuation and declarative apps without requiring Rivet/dense/enterprise features.
    MEASURE backup/recovery/capacity against the limited profile; no Fortune-500 availability claim from pilot size.
    ENABLE each capability using commit-bound code/provider evidence plus current approval.
    ROLL out signed image and compatible schema with health checks and explicit stop/repair path.
    KEEP executable apps and all sensitive unqualified routes disabled until their exact host/runner tests pass.
  TICKET-SPECIFIC SEGMENT:
    01. Test restore, cross-tenant denial, token/secret rotation, data erasure and emergency stop.
    02. Measure the pilot workload and reject unqualified sensitive/regulatory scopes.
    03. Require named support/on-call ownership and current provider terms.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN All functional tests pass but no restore or operator ownership evidence exists
    WHEN Pilot activation is requested
    THEN Activation remains blocked until the operating prerequisites pass; early launch does not waive core trust laws
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
