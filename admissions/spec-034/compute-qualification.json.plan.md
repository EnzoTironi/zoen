# File plan — `admissions/spec-034/compute-qualification.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-034/compute-qualification.json`. Representation: **sidecar-only**. Allocation: **required**.

Specs: [SPEC-034](../../docs/specs/spec-034.md).
Tickets: [ZN-0201](../../docs/tickets/zn-0201.md).

## Responsibility and reuse

```text
PROCEDURE ZN_0201 /* planning label, not a public API */
  OWNER := SPEC-034; TARGET := admissions/spec-034/compute-qualification.json
  REQUIRE accepted dependencies: ZN-0200
  REQUIRE evidence layer: admission; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    AUTHORIZE virtual-source/query or compute request under released definitions and current license/purpose.
    PLAN bounded remote work and reserve cost/egress before dispatch; select only admitted actual profile.
    PIN source/query/version/cut guarantees supported by provider; lack of snapshot coherence remains explicit.
    BROKER credentials and egress outside guests; no arbitrary remote SQL from an app.
    RUN tasks under fenced identity and record actual environment, inputs, partitions and result digests.
    VALIDATE output schema, completeness and lineage before making a published artifact.
    RETURN partial/unknown when provider guarantees or partitions are missing; retries preserve original task identity.
    PUBLISH through common authority/dataset interfaces, never install a parallel distributed truth store.
  TICKET-SPECIFIC SEGMENT:
    01. Select a provider/engine only through the recorded adapter contract and admission review.
    02. Run cancellation, lost-response, output-rights and budget tests on real infrastructure.
    03. Keep unqualified engine profiles disabled without constraining the portable contract.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN Only the portable interface is implemented
    WHEN A distributed/GPU capability is marked operational
    THEN The claim is rejected until the selected actual profile passes its evidence gate
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
