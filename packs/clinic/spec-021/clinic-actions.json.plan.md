# File plan — `packs/clinic/spec-021/clinic-actions.json`

**Status:** planned; no product acceptance implied.

Target: `packs/clinic/spec-021/clinic-actions.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-021](../../../docs/specs/spec-021.md).
Tickets: [ZN-0126](../../../docs/tickets/zn-0126.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0126 /* planning label, not a public API */
  OWNER := SPEC-021; TARGET := packs/clinic/spec-021/clinic-actions.json
  REQUIRE accepted dependencies: ZN-0125
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    DECLARE administrative identity, availability, appointment, room and restricted clinical references as data-only pack types.
    RESOLVE patient identity from guarded evidence; name alone cannot identify a patient.
    REPRESENT local appointments with explicit timezone and ambiguity handling.
    QUERY only authorized room/provider intervals and administrative facts; clinical counts/existence do not leak to reception.
    WHEN proposing scheduling changes use interval/predicate guards and the common ActionCase path.
    PREVENT concurrent double booking under authority domain fences; stale basis requires a new proposal.
    KEEP clinical payload and billing permissions independent from appointment visibility.
    REQUIRE actual approved clinical scope and provider evidence before affected operations can activate.
  TICKET-SPECIFIC SEGMENT:
    01. Author released reschedule and reminder definitions with provider/room interval predicate guards; do not activate effect dispatch before S4.
    02. Validate each capacity-changing action declares the same interval-domain guard and source coverage dependency.
    03. Run static/evaluation pack tests now; the real concurrent commit and reminder-delivery proof belongs to SPEC-024 domain-agency.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Two proposed reschedules target the same provider and room interval; S4 action execution is not yet admitted
    WHEN The compiler and evaluation harness validate the clinic pack
    THEN Both definitions require the shared interval guard and current source coverage; production rescheduling stays disabled until the S4 concurrent-commit proof passes
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
