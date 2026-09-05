# SPEC-007 — WorldFrames and the first semantic surface

**Milestone:** S0 · **Owner:** Kernel and Experience · **Root:** `packages/ontology/src/surfaces`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
One semantic operation registry feeds all surfaces. At S0 the registry is image-pinned; S2 makes its business definitions runtime-released. No temporary CRUD API may bypass it. Frames pin a consistent authorized basis.

## Owned state and storage contract
ontology.frames(frame_id PK,world_id,head_digest,cut_json,operation_id,plan_digest,perspective,rights_basis,payload_ref,created_at,expires_at); ontology.frame_pins(frame_id,evidence_or_snapshot_ref PK,retention_class). Opaque Focus records live in Eve, not here. Index frames by World and ID; no global public digest endpoint.

## Operations

```text
Inspect(operationId,input,purpose,expectedContract) -> WorldFrame; Explain(frameId,grant) -> Frame; OpenFrame(frameId,freshGrant) -> SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable; Discover(grant) -> AllowedOperationManifest.
```

## Execution protocol
Open one REPEATABLE READ snapshot for head, rights, domain cuts and immutable input refs. Materialize only bounded sparse inputs then close long scans’ database transaction. Compute payload from pinned data, and reauthorize before disclosure. Frame output includes gaps, perspective, evidence and temporal basis; a partial result never masquerades as complete.

V4 refinement: SPEC-050 names and constrains this existing dispatcher as SemanticExecutor. It does not create another executor. Every human UI, agent, mini app and programmatic adapter resolves the same released operation and invokes this implementation. Read, discovery, mutation, subscription and export share authority and result semantics.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-007](../algorithms/spec-007.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0042](../tickets/zn-0042.md) | Implement bounded Frame basis acquisition | component | [ZN-0036](../tickets/zn-0036.md) |
| [ZN-0043](../tickets/zn-0043.md) | Implement semantic dispatcher and stable error translation | component | [ZN-0042](../tickets/zn-0042.md) |
| [ZN-0044](../tickets/zn-0044.md) | Implement authorized discovery and explanation references | component | [ZN-0043](../tickets/zn-0043.md) |
| [ZN-0045](../tickets/zn-0045.md) | Ship the minimum web and CLI divergence flow | journey | [ZN-0044](../tickets/zn-0044.md), [ZN-0291](../tickets/zn-0291.md), [ZN-0292](../tickets/zn-0292.md) |
| [ZN-0046](../tickets/zn-0046.md) | Reauthorize result disclosure and historical reopen | component | [ZN-0045](../tickets/zn-0045.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `interfaces-sdk-and-mcp.md`, `authority-concurrency-and-cuts.md`, `types-and-protocols.md`. Read a named historical reference only when needed; it cannot override current contracts.
