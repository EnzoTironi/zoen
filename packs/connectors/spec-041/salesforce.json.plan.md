# File plan — `packs/connectors/spec-041/salesforce.json`

**Status:** planned; no product acceptance implied.

Target: `packs/connectors/spec-041/salesforce.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-041](../../../docs/specs/spec-041.md).
Tickets: [ZN-0239](../../../docs/tickets/zn-0239.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0239 /* planning label, not a public API */
  OWNER := SPEC-041; TARGET := packs/connectors/spec-041/salesforce.json
  REQUIRE accepted dependencies: ZN-0238
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    LOAD a versioned source recipe and actual provider API/account qualification, not customer-specific code branches.
    VALIDATE auth scope, object schemas, namespace/revision keys, incremental/deletion rules and inherited ACLs.
    CONFIGURE instance credentials/cursors outside the reusable pack; use ordinary SourceChange governance.
    ACQUIRE actual source data with source machinery and checkpoint only durable admissions.
    COMPARE business metrics only after normalizing meanings, entities, scope, time and unit.
    KEEP booked/invoiced/received or forecast/actual as different meanings; comparable contradictions retain both sources.
    ROUTE scoped questions to authorized stewards and publish reusable mappings only through evaluation/release.
    TEST actual owned source accounts with synthetic authorized records; absent source is blocked, never a simulated business result.
  TICKET-SPECIFIC SEGMENT:
    01. Declare the admitted Salesforce account/opportunity read profile and incremental revision semantics.
    02. Keep bookings/forecast/closed opportunity meanings separate from invoices/cash.
    03. Qualify field-level visibility, deletes, pagination and rate limits.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN CRM opportunities total 1000 while ERP invoices total 800
    WHEN The recipe publishes its metrics
    THEN It labels the source as bookings/CRM state and does not call the difference a source error by default
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
