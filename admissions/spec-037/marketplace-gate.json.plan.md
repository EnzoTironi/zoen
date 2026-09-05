# File plan — `admissions/spec-037/marketplace-gate.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-037/marketplace-gate.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-037](../../docs/specs/spec-037.md).
Tickets: [ZN-0217](../../docs/tickets/zn-0217.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0217 /* planning label, not a public API */
  OWNER := SPEC-037; TARGET := admissions/spec-037/marketplace-gate.json
  REQUIRE accepted dependencies: ZN-0216
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    VERIFY publisher artifact identities, dependency closure and local policy before installation.
    SEPARATE reusable definitions from per-World source credentials, private instances and overlays.
    COMPUTE semantic/permission/retention diff for upgrades; conflicts are explicit, not last-writer wins.
    PREPARE migration and classify affected Cases/Watches/Mandates/apps/sessions under common release machinery.
    APPROVE under current local rights; marketplace reputation cannot grant new powers.
    ACTIVATE exact immutable binding, never external latest; compatible rename differs from meaning compatibility.
    ON uninstall/recall stop new use and handle pins, historical explanation, open work and private caches explicitly.
    REPORT unsupported distribution/license/provider scope rather than treating package presence as production qualification.
  TICKET-SPECIFIC SEGMENT:
    01. Implement terms/version/entitlement state and billing-provider port without storing payment credentials.
    02. Require approved publisher support, abuse handling, refund/recall and security responsibilities.
    03. Separate installability from commercial marketplace launch.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Technical installation works but publisher terms/support/payment operations are unapproved
    WHEN A public paid marketplace launch is requested
    THEN Launch remains blocked; no technical registry test is treated as commercial readiness
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
