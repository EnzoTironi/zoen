# File plan — `packages/ontology/src/surfaces/dispatch.ts`

**Status:** candidate-unaccepted; no product acceptance implied.

Target: `packages/ontology/src/surfaces/dispatch.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-007](../../../../docs/specs/spec-007.md), [SPEC-050](../../../../docs/specs/spec-050.md).
Tickets: [ZN-0043](../../../../docs/tickets/zn-0043.md), [ZN-0291](../../../../docs/tickets/zn-0291.md), [ZN-0293](../../../../docs/tickets/zn-0293.md), [ZN-0294](../../../../docs/tickets/zn-0294.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0043 /* planning label, not a public API */
  OWNER := SPEC-007; TARGET := packages/ontology/src/surfaces/dispatch.ts
  REQUIRE accepted dependencies: ZN-0042
  REQUIRE evidence layer: component; actual admitted services when needed
  IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
  IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
  USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
    INPUT enters through one dispatcher using a verified server context; never accept client-supplied principal/grant as proof.
    VALIDATE envelope, released operation ID, compatible contract, bounded arguments and purpose.
    RESOLVE exactly one released handler; transports do not implement business policy or reconciliation.
    FOR reads: open coherent head/rights/domain cut in REPEATABLE READ; constrain authorized set before ranking/aggregation.
    PIN exact immutable evidence/dataset refs; materialize bounded sparse inputs, then close long-running SQL snapshots.
    COMPUTE the operation result at the pinned basis; preserve gaps, uncertainty, source lineage and interpretation status.
    FOR mutations call AuthorityCommit/ActionCase; for streams/exports use the same registered operations and current disclosure checks.
    REAUTHORIZE before payload/chunk delivery; changed rights => denied or safely rebuilt result, never stale authorization reuse.
    RETURN one tagged semantic result; text, UI and transport framing happen outside this executor.
  TICKET-SPECIFIC SEGMENT:
    01. Dispatch only known operation IDs with schema and contract digest validation.
    02. Map domain errors through the common disclosure-safe envelope.
    03. Prevent direct table names, arbitrary SQL and unregistered invoke methods at every entrypoint.
    04. V4: use the existing SPEC-007 dispatcher and shared SemanticClient; validate no per-surface authorization or reconciliation implementation is introduced.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN A valid inspect request and requests containing SQL, unknown operation and mismatched digest
    WHEN They reach web and CLI adapters
    THEN The valid request executes once; the others fail explicitly with no raw database access or silent version fallback
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
