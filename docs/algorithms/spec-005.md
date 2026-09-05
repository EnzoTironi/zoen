# SPEC-005 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-005](../specs/spec-005.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Knowledge**. Module: `packages/ontology/src/interpretation`. Milestone: **S0**.

## Normative operation signatures

```text
CompareClaims(claims,meaningProfile) -> ComparableGroups; Interpret(query,basis,perspective) -> Interpretation; ApplyScopedReply(caseId,questionDigest,answer,operationId) -> CorrectionReceipt | Stale; Explain(interpretationId,grant) -> ExplanationFrame.
```

## State and transaction contract

ontology.claims(claim_id PK,world_id,subject_id,predicate_id,value_json,unit,scope_json,valid_from,valid_until,source_family,evidence_refs,asserted_by,domain_id,knowledge_version); ontology.claim_edges(world_id,parent_id,child_id,kind PK); ontology.interpretations(interpretation_id PK,world_id,query_digest,release_digest,cut_digest,perspective,status,verification,contested,selected_refs,rival_refs,dependency_refs); ontology.corrections(correction_id PK,world_id,target_claim,successor_claim,actor,case_ref,receipt_ref). Values are immutable except governed erasure.

## Shared algorithm

```text
OPEN authorized inputs at one meaning/release/knowledge basis; unauthorized rivals cannot alter view-local counts or wording.
PARTITION by subject identity, predicate semantics, scope, compatible interval, dimension/unit and conversion evidence.
BUILD provenance-family closure; copied or derived statements in one family do not increase independent support.
APPLY the released selection rule; preserve selected, contested and verification as independent axes.
RETURN unknown for no authorized support; unresolved for unranked comparable rivals; expose non-comparability rather than inventing conflict.
FOR a reply: verify question digest, candidate set, authority, answer kind and exact intended scope.
APPEND an attributed assertion/correction or propose a separate identity/rule/preference operation; never silently install a global rule.
INVALIDATE descendants and affected guards with cycle/budget limits; historical claims remain addressable under current rights.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0031](../tickets/zn-0031.md) | Implement comparability before disagreement | [packages/ontology/src/interpretation/comparability.ts](../../packages/ontology/src/interpretation/comparability.ts) |
| [ZN-0032](../tickets/zn-0032.md) | Collapse dependent source families without deleting provenance | [packages/ontology/src/interpretation/families.ts](../../packages/ontology/src/interpretation/families.ts) |
| [ZN-0033](../tickets/zn-0033.md) | Implement deterministic interpretation outcomes | [packages/ontology/src/interpretation/interpret.ts](../../packages/ontology/src/interpretation/interpret.ts) |
| [ZN-0034](../tickets/zn-0034.md) | Apply a human correction with exact scope and undo | [packages/ontology/src/interpretation/correction.ts](../../packages/ontology/src/interpretation/correction.ts) |
| [ZN-0035](../tickets/zn-0035.md) | Propagate correction impact and expose quality dimensions | [packages/ontology/src/interpretation/impact.ts](../../packages/ontology/src/interpretation/impact.ts) |
| [ZN-0036](../tickets/zn-0036.md) | Prove point-in-time and visible-perspective reconciliation | [packages/ontology/src/interpretation/interpretation-laws.ts](../../packages/ontology/src/interpretation/interpretation-laws.ts) |

## Required proof boundaries

Group only equal subject identity, predicate semantics, compatible scope/time/unit and version basis. Count copied/derived source families once. A declared precedence can select a claim while contested remains true. No authorized evidence yields unknown; competing unranked evidence yields unresolved. Retractions append edges and revisions. Recompute descendants with cycle detection and leave active consumers stale until their projection cut catches up.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
