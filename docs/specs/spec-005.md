# SPEC-005 — Comparable claims, interpretations and scoped correction

**Milestone:** S0 · **Owner:** Knowledge · **Root:** `packages/ontology/src/interpretation`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Compare meaning before comparing values. Preserve selection, contestation and verification separately. Initial resolution uses deterministic released precedence, never majority voting or model confidence. Human replies are attributed claims or decisions, not automatic global rules.

## Owned state and storage contract
ontology.claims(claim_id PK,world_id,subject_id,predicate_id,value_json,unit,scope_json,valid_from,valid_until,source_family,evidence_refs,asserted_by,domain_id,knowledge_version); ontology.claim_edges(world_id,parent_id,child_id,kind PK); ontology.interpretations(interpretation_id PK,world_id,query_digest,release_digest,cut_digest,perspective,status,verification,contested,selected_refs,rival_refs,dependency_refs); ontology.corrections(correction_id PK,world_id,target_claim,successor_claim,actor,case_ref,receipt_ref). Values are immutable except governed erasure.

## Operations

```text
CompareClaims(claims,meaningProfile) -> ComparableGroups; Interpret(query,basis,perspective) -> Interpretation; ApplyScopedReply(caseId,questionDigest,answer,operationId) -> CorrectionReceipt | Stale; Explain(interpretationId,grant) -> ExplanationFrame.
```

## Execution protocol
Group only equal subject identity, predicate semantics, compatible scope/time/unit and version basis. Count copied/derived source families once. A declared precedence can select a claim while contested remains true. No authorized evidence yields unknown; competing unranked evidence yields unresolved. Retractions append edges and revisions. Recompute descendants with cycle detection and leave active consumers stale until their projection cut catches up.

## Pseudocode and file ownership

[algorithm SPEC-005](../algorithms/spec-005.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0031](../tickets/zn-0031.md) | Implement comparability before disagreement | component | [ZN-0030](../tickets/zn-0030.md) |
| [ZN-0032](../tickets/zn-0032.md) | Collapse dependent source families without deleting provenance | law | [ZN-0031](../tickets/zn-0031.md) |
| [ZN-0033](../tickets/zn-0033.md) | Implement deterministic interpretation outcomes | component | [ZN-0032](../tickets/zn-0032.md) |
| [ZN-0034](../tickets/zn-0034.md) | Apply a human correction with exact scope and undo | component | [ZN-0033](../tickets/zn-0033.md) |
| [ZN-0035](../tickets/zn-0035.md) | Propagate correction impact and expose quality dimensions | component | [ZN-0034](../tickets/zn-0034.md) |
| [ZN-0036](../tickets/zn-0036.md) | Prove point-in-time and visible-perspective reconciliation | component | [ZN-0035](../tickets/zn-0035.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `truth-reconciliation-and-learning.md`, `identity-and-time.md`. Read a named historical reference only when needed; it cannot override current contracts.
