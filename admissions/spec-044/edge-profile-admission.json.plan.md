# File plan — `admissions/spec-044/edge-profile-admission.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-044/edge-profile-admission.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-044](../../docs/specs/spec-044.md).
Tickets: [ZN-0260](../../docs/tickets/zn-0260.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0260 /* planning label, not a public API */
  OWNER := SPEC-044; TARGET := admissions/spec-044/edge-profile-admission.json
  REQUIRE accepted dependencies: ZN-0259
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    REQUIRE a separately admitted child-World profile with bounded rights/resource partition, expiry and clock assumptions.
    ISSUE lease through parent authority with explicit allowed operations and maximum disconnected horizon.
    RUN the same admitted semantic implementation in the child; local app caches never become a second authority.
    REJECT unpartitioned/nonreversible external effects by default; no queue of hidden provider writes awaiting reconnect.
    RECORD ordered local receipts and observed basis under lease/fence with resource conservation.
    ON reconnect submit receipts as evidence for reconciliation, not commands to replay blindly.
    CLASSIFY admitted/conflict/expired results under current parent policy and source state.
    QUALIFY self-hosted/fleet updates against the same laws; this future product feature is not a testing/service substitute.
  TICKET-SPECIFIC SEGMENT:
    01. Run offline expiry/reconnect, platform isolation, upgrade and recovery drills.
    02. Record platform/runtime support matrix and operating ownership.
    03. Keep each profile independently gated.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN One edge profile is tested but a different self-hosted platform is not
    WHEN Both are advertised as supported
    THEN Only the tested profile can be admitted; equivalent API shape is insufficient evidence
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
