# File plan — `admissions/spec-038/identity-provider-qualification.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-038/identity-provider-qualification.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-038](../../docs/specs/spec-038.md).
Tickets: [ZN-0224](../../docs/tickets/zn-0224.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0224 /* planning label, not a public API */
  OWNER := SPEC-038; TARGET := admissions/spec-038/identity-provider-qualification.json
  REQUIRE accepted dependencies: ZN-0223
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    VERIFY issuer/audience/signature/time through admitted identity library and current metadata rotation contract.
    MAP stable issuer/subject identifiers; do not merge accounts solely by email.
    PROCESS SCIM create/update/deactivate idempotently with provider revision and local guards.
    APPLY group-to-role mapping only within released organization policy; directory data cannot expand platform trust.
    ON deactivation revoke current access, browser/workload bindings and streams at documented boundaries.
    REACTIVATION is a fresh governed mapping, not replay of old privileges.
    MINT distinct workload identity with narrow scope, rotation/expiry and attributable delegation chain.
    QUALIFY actual IdP/SCIM tenant and failure modes; no development administrator or fake SSO bypass.
  TICKET-SPECIFIC SEGMENT:
    01. Record issuer/key rotation, SCIM replay/deprovisioning and support ownership evidence.
    02. Validate the actual customer/provider metadata and admin permissions.
    03. Keep each connection unadmitted until its scope-specific report passes.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Protocol conformance passes against a local identity test system only
    WHEN An enterprise connection is marked operational
    THEN Activation is blocked until real identity-provider qualification is attached
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
