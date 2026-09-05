# File plan — `packages/clients/src/semantic-client.ts`

**Status:** candidate-unaccepted; no product acceptance implied.

Target: `packages/clients/src/semantic-client.ts`. Representation: **existing-with-sidecar**. Allocation: **conditional-support**.

Specs: [SPEC-050](../../../docs/specs/spec-050.md).
Tickets: [ZN-0291](../../../docs/tickets/zn-0291.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
CONDITIONAL SUPPORT SEGMENT.
FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
READ the current implementation and shared module algorithm; select only the missing support responsibility.
KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
WIRE into the owning ticket's declared entry and prove its exact tests.
```

## Owning state / operation contracts

### SPEC-050
SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.

No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.

[algorithm SPEC-050](../../../docs/algorithms/spec-050.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
