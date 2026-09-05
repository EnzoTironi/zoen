# File plan — `admissions/spec-010/provider-qualification.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-010/provider-qualification.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-010](../../docs/specs/spec-010.md).
Tickets: [ZN-0063](../../docs/tickets/zn-0063.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0063 /* planning label, not a public API */
  OWNER := SPEC-010; TARGET := admissions/spec-010/provider-qualification.json
  REQUIRE accepted dependencies: ZN-0062
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    LOAD only settled visible conversation events and authority-free Focus.
    REOPEN every referenced Frame under current rights/purpose; missing context remains an explicit gap.
    SEGREGATE retrieved source text as untrusted data, not executable instructions or tool policy.
    INTERSECT released skill, current grant, app/workload scope and budget to determine tools.
    SELECT only an admitted model/data-use/residency route with sufficient budget; otherwise NoPermittedModel.
    COMPOSE bounded context with evidence references and provisional summaries; exclude hidden reasoning fields.
    CAPTURE real provider outputs and usage; validate structured calls and send them to the same semantic executor.
    TREAT audio transcription as an attributed candidate statement; consequential consent uses the normal confirmation path.
  TICKET-SPECIFIC SEGMENT:
    01. Use authorized provider sandbox/accounts and record model/API versions.
    02. Test tool schema round-trip, timeout, output fields, usage and retention/data-use configuration.
    03. Keep routes disabled until qualification evidence is accepted.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Local protocol tests pass but no provider qualification evidence exists
    WHEN Production model/voice activation is requested
    THEN Activation remains blocked; a real accepted qualification report records observed behavior and all limitations
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
