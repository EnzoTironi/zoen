# File plan — `admissions/spec-011/whatsapp-qualification.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-011/whatsapp-qualification.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-011](../../docs/specs/spec-011.md).
Tickets: [ZN-0069](../../docs/tickets/zn-0069.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0069 /* planning label, not a public API */
  OWNER := SPEC-011; TARGET := admissions/spec-011/whatsapp-qualification.json
  REQUIRE accepted dependencies: ZN-0068
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    VERIFY exact admitted provider signature/replay contract on raw bytes before parsing; do not invent headers.
    CHECK account namespace, payload limits and event identity; persist ingress and owned outbox before ACK.
    DEDUPLICATE provider replay by stable event identity and dispatch one Eve turn after durable admission.
    BIND channel to principal only via verified secure challenge and explicit consent; sender number is not a World grant.
    CREATE authority-free continuation through SPEC-051; preview GET/HEAD is generic and consumes nothing.
    BEFORE sending recheck audience, current disclosure, consent, provider template/window rules and enabled qualification.
    PERSIST delivery intent then call the real provider outside authority transaction; observe actual accepted/delivered/unknown evidence.
    ON lost acknowledgement reconcile known provider identity; never synthesize delivered status or blindly duplicate a consequential send.
  TICKET-SPECIFIC SEGMENT:
    01. Record supported API/version, account scope, signatures, consent/template policies and costs from current primary evidence.
    02. Run two authorized account journeys with duplicate delivery and timeout observation.
    03. Keep public route disabled until operational/legal owner and security reviewer accept the evidence.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Only local protocol fixtures exist
    WHEN The team attempts live WhatsApp activation
    THEN The capability stays disabled until the real provider report and external gate are accepted; local fixtures are not described as production proof
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
