# File plan — `runbooks/spec-005/impact.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-005/impact.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-005](../../docs/specs/spec-005.md).
Tickets: [ZN-0035](../../docs/tickets/zn-0035.md).

## Responsibility and reuse

## ZN-0035 operational/repair procedure

Scope: Propagate correction impact and expose quality dimensions. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The impact worker consumes the committed correction
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
OPEN authorized inputs at one meaning/release/knowledge basis; unauthorized rivals cannot alter view-local counts or wording.
PARTITION by subject identity, predicate semantics, scope, compatible interval, dimension/unit and conversion evidence.
BUILD provenance-family closure; copied or derived statements in one family do not increase independent support.
APPLY the released selection rule; preserve selected, contested and verification as independent axes.
RETURN unknown for no authorized support; unresolved for unranked comparable rivals; expose non-comparability rather than inventing conflict.
FOR a reply: verify question digest, candidate set, authority, answer kind and exact intended scope.
APPEND an attributed assertion/correction or propose a separate identity/rule/preference operation; never silently install a global rule.
INVALIDATE descendants and affected guards with cycle/budget limits; historical claims remain addressable under current rights.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The plan and dependent Case become stale; the unrelated invoice remains valid; quality output declares the affected scope and projection lag
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-005
CompareClaims(claims,meaningProfile) -> ComparableGroups; Interpret(query,basis,perspective) -> Interpretation; ApplyScopedReply(caseId,questionDigest,answer,operationId) -> CorrectionReceipt | Stale; Explain(interpretationId,grant) -> ExplanationFrame.

ontology.claims(claim_id PK,world_id,subject_id,predicate_id,value_json,unit,scope_json,valid_from,valid_until,source_family,evidence_refs,asserted_by,domain_id,knowledge_version); ontology.claim_edges(world_id,parent_id,child_id,kind PK); ontology.interpretations(interpretation_id PK,world_id,query_digest,release_digest,cut_digest,perspective,status,verification,contested,selected_refs,rival_refs,dependency_refs); ontology.corrections(correction_id PK,world_id,target_claim,successor_claim,actor,case_ref,receipt_ref). Values are immutable except governed erasure.

[algorithm SPEC-005](../../docs/algorithms/spec-005.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
