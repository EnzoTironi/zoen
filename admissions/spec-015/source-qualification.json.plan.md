# File plan — `admissions/spec-015/source-qualification.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-015/source-qualification.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-015](../../docs/specs/spec-015.md).
Tickets: [ZN-0095](../../docs/tickets/zn-0095.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0095 /* planning label, not a public API */
  OWNER := SPEC-015; TARGET := admissions/spec-015/source-qualification.json
  REQUIRE accepted dependencies: ZN-0094
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    REGISTER provider recipe and instance separately; record credential references only.
    VALIDATE scopes, source namespaces, allowed destinations, query templates, incremental strategy and license/ACL behavior.
    PERFORM real OAuth binding through supported provider flow; validate state/PKCE/redirect contract in admitted adapter.
    STORE secret material only in broker-owned secret storage; runtime definition sees an opaque binding reference.
    ACQUIRE bounded source pages with watermark and request identity; source missing page is not deletion.
    CHECK current source rights/freshness; stage raw capture before mapping/admission through existing evidence machinery.
    COMMIT checkpoints only after durable capture/admission position; deduplicate replay without dropping genuine revision changes.
    QUALIFY each actual source account/profile; missing permission or credentials keeps that binding disabled, not emulated.
  TICKET-SPECIFIC SEGMENT:
    01. Run an owned provider account through auth, paging, drift, revocation and retry tests.
    02. Record supported API version, scopes, rate-limit behavior and data-use constraints.
    03. Disable unqualified source recipes rather than substituting fabricated records.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Local HTTP profile tests pass but the provider’s API behavior is unverified
    WHEN The source is offered as production-ready
    THEN It remains unqualified until actual account evidence and owner approval are accepted
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
