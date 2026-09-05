# File plan — `admissions/spec-051/protected-link-admission.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-051/protected-link-admission.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-051](../../docs/specs/spec-051.md).
Tickets: [ZN-0301](../../docs/tickets/zn-0301.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0301 /* planning label, not a public API */
  OWNER := SPEC-051; TARGET := admissions/spec-051/protected-link-admission.json
  REQUIRE accepted dependencies: ZN-0290, ZN-0298, ZN-0300
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    CREATE a random opaque link reference for permitted Focus/app target, recipient constraint, version policy and optional expiry.
    STORE no access token in URL; creation, publication, invitation and sharing remain distinct operations.
    GET/HEAD/previews return generic side-effect-free content without data, challenge consumption or target existence leaks.
    ON explicit POST exchange validate CSRF/origin and browser-bound challenge, then verify Door identity/assurance.
    RESOLVE target through current World membership, recipient constraint, app publication/recall and source rights.
    ISSUE server-side scoped session bound to principal/actor/World/realm/purpose/exact publication/security revision/expiry.
    ON every later semantic call recheck session and current rights; stable link never preserves old grants.
    REVOKE link and session independently; historical rendering cannot revive recalled code or erased content.
  TICKET-SPECIFIC SEGMENT:
    01. Qualify TLS/DNS, cookie separation, edge/cache headers, CSRF/origin and challenge handling on a real deployed host.
    02. Run device/browser matrix including unavailable storage and embedded-browser fallback; never require a third-party cookie to reach a direct host link.
    03. Record independent security evidence and disable only protected app delivery when it fails.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A real shared pilot and the complete protected-link journey
    WHEN The exact host/browser profile requests admission
    THEN Admission cites deployed configuration, browser traces, revocation results and negative tests; missing evidence leaves the route disabled
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
