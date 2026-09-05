# File plan — `tooling/semantic-boundaries/no-bypass-graph.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `tooling/semantic-boundaries/no-bypass-graph.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-050](../../docs/specs/spec-050.md).
Tickets: [ZN-0292](../../docs/tickets/zn-0292.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
PROCEDURE ZN_0292 /* planning label, not a public API */
  OWNER := SPEC-050; TARGET := tooling/semantic-boundaries/no-bypass-graph.ts
  REQUIRE accepted dependencies: ZN-0003, ZN-0291
  REQUIRE evidence layer: static; actual admitted services when needed
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
    01. Classify trusted executor/repository composition and untrusted human, agent, app and runner client roots.
    02. Deny imports of repositories, SQL/index clients and source credentials from client roots; account for reexports and dynamic imports.
    03. Define a network/secret allowlist regression fixture and fail on any new unreviewed data ingress.
  TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
    GIVEN The declared module graph and all S0 client roots
    WHEN A mini-app or Eve module imports a raw pg adapter through a barrel
    THEN The static gate fails with the forbidden edge; ordinary SemanticClient imports remain valid
  ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
  RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
