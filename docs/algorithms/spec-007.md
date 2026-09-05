# SPEC-007 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-007](../specs/spec-007.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel and Experience**. Module: `packages/ontology/src/surfaces`. Milestone: **S0**.

## Normative operation signatures

```text
Inspect(operationId,input,purpose,expectedContract) -> WorldFrame; Explain(frameId,grant) -> Frame; OpenFrame(frameId,freshGrant) -> SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable; Discover(grant) -> AllowedOperationManifest.
```

## State and transaction contract

ontology.frames(frame_id PK,world_id,head_digest,cut_json,operation_id,plan_digest,perspective,rights_basis,payload_ref,created_at,expires_at); ontology.frame_pins(frame_id,evidence_or_snapshot_ref PK,retention_class). Opaque Focus records live in Eve, not here. Index frames by World and ID; no global public digest endpoint.

## Shared algorithm

```text
INPUT enters through one dispatcher using a verified server context; never accept client-supplied principal/grant as proof.
VALIDATE envelope, released operation ID, compatible contract, bounded arguments and purpose.
RESOLVE exactly one released handler; transports do not implement business policy or reconciliation.
FOR reads: open coherent head/rights/domain cut in REPEATABLE READ; constrain authorized set before ranking/aggregation.
PIN exact immutable evidence/dataset refs; materialize bounded sparse inputs, then close long-running SQL snapshots.
COMPUTE the operation result at the pinned basis; preserve gaps, uncertainty, source lineage and interpretation status.
FOR mutations call AuthorityCommit/ActionCase; for streams/exports use the same registered operations and current disclosure checks.
REAUTHORIZE before payload/chunk delivery; changed rights => denied or safely rebuilt result, never stale authorization reuse.
RETURN one tagged semantic result; text, UI and transport framing happen outside this executor.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0042](../tickets/zn-0042.md) | Implement bounded Frame basis acquisition | [packages/ontology/src/surfaces/frame-basis.ts](../../packages/ontology/src/surfaces/frame-basis.ts) |
| [ZN-0043](../tickets/zn-0043.md) | Implement semantic dispatcher and stable error translation | [packages/ontology/src/surfaces/dispatch.ts](../../packages/ontology/src/surfaces/dispatch.ts.plan.md) |
| [ZN-0044](../tickets/zn-0044.md) | Implement authorized discovery and explanation references | [packages/ontology/src/surfaces/discovery.ts](../../packages/ontology/src/surfaces/discovery.ts) |
| [ZN-0045](../tickets/zn-0045.md) | Ship the minimum web and CLI divergence flow | [tests/journey/spec-007/first-surface.test.ts](../../tests/journey/spec-007/first-surface.test.ts) |
| [ZN-0046](../tickets/zn-0046.md) | Reauthorize result disclosure and historical reopen | [packages/ontology/src/surfaces/frame-disclosure.ts](../../packages/ontology/src/surfaces/frame-disclosure.ts) |

## Required proof boundaries

Open one REPEATABLE READ snapshot for head, rights, domain cuts and immutable input refs. Materialize only bounded sparse inputs then close long scans’ database transaction. Compute payload from pinned data, and reauthorize before disclosure. Frame output includes gaps, perspective, evidence and temporal basis; a partial result never masquerades as complete.

V4 refinement: SPEC-050 names and constrains this existing dispatcher as SemanticExecutor. It does not create another executor. Every human UI, agent, mini app and programmatic adapter resolves the same released operation and invokes this implementation. Read, discovery, mutation, subscription and export share authority and result semantics.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
