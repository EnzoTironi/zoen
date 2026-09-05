# File plan — `admissions/spec-028/channel-qualification.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-028/channel-qualification.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-028](../../docs/specs/spec-028.md).
Tickets: [ZN-0168](../../docs/tickets/zn-0168.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0168 /* planning label, not a public API */
  OWNER := SPEC-028; TARGET := admissions/spec-028/channel-qualification.json
  REQUIRE accepted dependencies: ZN-0167
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    VERIFY each provider's actual supported webhook scheme, raw bytes and account namespace.
    PERSIST stable ingress and owned outbox before acknowledgement using shared channel durability patterns.
    TREAT email headers/chat IDs as provider references, not identity proof; reject header/address injection.
    BOUND attachments and admit bytes through quarantine/evidence machinery.
    LINK/rebind identity via fresh challenge and explicit consent; changed recipient triggers new audience check.
    REOPEN Focus through the same semantic client; carry no prior channel credentials into World authority.
    PREPARE delivery under current policy and actual provider profile; retain accepted/delivered/read/unknown as observed.
    QUALIFY real provider accounts; no invented email/Telegram endpoints or offline delivery substitute.
  TICKET-SPECIFIC SEGMENT:
    01. Run owned account tests for webhook auth, duplicate ingress, consent, attach limits and timeout.
    02. Record provider/API editions and independently observe received messages.
    03. Keep each provider route gated independently.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN One provider is qualified and the other has only local fixtures
    WHEN Multichannel activation is requested
    THEN Only the qualified route can activate; shared transport tests do not certify the other provider
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
