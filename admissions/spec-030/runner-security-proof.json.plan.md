# File plan — `admissions/spec-030/runner-security-proof.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-030/runner-security-proof.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-030](../../docs/specs/spec-030.md).
Tickets: [ZN-0179](../../docs/tickets/zn-0179.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0179 /* planning label, not a public API */
  OWNER := SPEC-030; TARGET := admissions/spec-030/runner-security-proof.json
  REQUIRE accepted dependencies: ZN-0178
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    ACQUIRE lease bound to World/realm/principal/purpose/artifact/input cut/budget/epoch and admitted host profile.
    START outside authority process in actual qualified containment with default-deny network and no ambient credentials.
    DENY host files, container socket, metadata endpoints and authority/source secrets; enforce limits outside guest process.
    FOR an app request expose only released semantic calls through the common executor; no generic URL/SQL/provider proxy.
    FOR separately admitted acquisition/effect lanes validate capability, destination, DNS/redirect chain, body and lease on every use.
    SUPPLY immutable read inputs for analysis, record nondeterminism/seed/environment and output lineage.
    VALIDATE bounded outputs and current rights before admission; publishing is a separate governed operation.
    ON expiry/revocation/resource violation stop fenced execution, retain real unknown effects and cleanup only unpinned artifacts.
  TICKET-SPECIFIC SEGMENT:
    01. Run SSRF, cross-tenant file, secret echo, dependency malware and resource attacks.
    02. Capture host/network enforcement evidence and cleanup results.
    03. Require independent security review before live custom execution.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Local container tests pass but the hardened host profile has not been tested
    WHEN Custom-code production activation is requested
    THEN The feature remains blocked until actual isolation evidence passes; container startup is not accepted as a security proof
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
