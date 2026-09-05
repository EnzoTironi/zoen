# File plan — `packages/ontology/src/surfaces/executor-binding.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `packages/ontology/src/surfaces/executor-binding.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-050](../../../../docs/specs/spec-050.md).
Tickets: [ZN-0291](../../../../docs/tickets/zn-0291.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0291 /* planning label, not a public API */
  OWNER := SPEC-050; TARGET := packages/ontology/src/surfaces/executor-binding.ts
  REQUIRE accepted dependencies: ZN-0043, ZN-0044
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    NORMALIZE transport input into the common envelope; obtain identity and app/workload context only from verified server bindings.
    RESOLVE allowed operation using the existing SPEC-007 dispatcher; do not instantiate another executor.
    PRESERVE intent ID, contract digest, basis and purpose on retry/resumption; a new ID is a new intention.
    INTERSECT current user/delegation rights, admitted app capabilities and current source restrictions centrally.
    FOR batches/streams/exports support bounded work and exact basis; reauthorize each item/chunk/resumption.
    CACHE only with full subject/World/delegation/app/purpose/release/query/cut/security key; references are not permits.
    COMPARE canonical semantic outcomes under equivalent authority/basis, not natural-language presentation.
    AUDIT every ingress/asset/export/worker path for bypasses; structured app calls require neither Eve nor an LLM.
  TICKET-SPECIFIC SEGMENT:
    01. Define a small SemanticClient port in packages/contracts; connect it to SPEC-007 dispatch.ts, do not create a second dispatch engine.
    02. Wire web/CLI and trusted internal adapters to the same registration table and operation handlers.
    03. Add instrumented executor-entry witness for component tests; production logs contain opaque IDs and digests only.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN The S0 Frame dispatcher and two authorized conflicting records exist
    WHEN Web and CLI issue the same Inspect under equal verified context and pinned basis
    THEN Both enter SPEC-007 dispatch.ts and return the same authorized interpretation, rival references, basis and result tag; no model invocation occurs
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
