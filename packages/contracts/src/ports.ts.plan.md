# File plan — `packages/contracts/src/ports.ts`

**Status:** candidate-unaccepted; no product acceptance implied.

Target: `packages/contracts/src/ports.ts`. Representation: **existing-with-sidecar**. Allocation: **conditional-support**.

Specs: [SPEC-001](../../../docs/specs/spec-001.md), [SPEC-007](../../../docs/specs/spec-007.md), [SPEC-050](../../../docs/specs/spec-050.md).
Tickets: Existing candidate support; ticket ownership is in the spec, not implied acceptance..

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
CONTRACT SURFACE PLAN.
DEFINE only the owning module's input/output/error/state and dependency-port types.
REUSE branded kernel values, verified context, common semantic envelope and typed results.
DO NOT export repositories or broad credentials to clients; authority context is server verified.
SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
```

## Owning state / operation contracts

### SPEC-001
parseEnvelope(bytes) -> ValidEnvelope | InvalidInput; normalizeDecimal(text, scalePolicy) -> Decimal | InvalidScalar; compareIntervals(a,b) -> ComparableInterval | NonComparable; canonicalDigest(value) -> sha256.

No tables. Normative JSON schemas live under contracts/kernel. IDs are opaque UUID values tagged at runtime with world/realm; counters and monetary values cross JSON as decimal strings. Database identifiers must not be guessable credentials.

[algorithm SPEC-001](../../../docs/algorithms/spec-001.md)

### SPEC-007
Inspect(operationId,input,purpose,expectedContract) -> WorldFrame; Explain(frameId,grant) -> Frame; OpenFrame(frameId,freshGrant) -> SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable; Discover(grant) -> AllowedOperationManifest.

ontology.frames(frame_id PK,world_id,head_digest,cut_json,operation_id,plan_digest,perspective,rights_basis,payload_ref,created_at,expires_at); ontology.frame_pins(frame_id,evidence_or_snapshot_ref PK,retention_class). Opaque Focus records live in Eve, not here. Index frames by World and ID; no global public digest endpoint.

[algorithm SPEC-007](../../../docs/algorithms/spec-007.md)

### SPEC-050
SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.

No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.

[algorithm SPEC-050](../../../docs/algorithms/spec-050.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
