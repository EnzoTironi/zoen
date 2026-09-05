# File plan — `tests/fixtures/spec-017/steward-workbench.json`

**Status:** planned; no product acceptance implied.

Target: `tests/fixtures/spec-017/steward-workbench.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-017](../../../docs/specs/spec-017.md).
Tickets: [ZN-0105](../../../docs/tickets/zn-0105.md).

## Responsibility and reuse

```text
CONDITIONAL INPUT FIXTURE PLAN — not an observed service result.
USE synthetic records within owned disposable namespaces and explicit valid/knowledge time.
INCLUDE comparable rivals, a denied source, duplicate provenance family and stale dependency when in scope.
COMPUTE fixed expected values from the owning oracle, not from the implementation under test.
LOAD through the real component/journey boundary; do not replace provider/database behavior with this file.
VERSION seed, units, rights and cleanup scope.
```

## Owning state / operation contracts

### SPEC-017
RankClarifications(scope,budget) -> QuestionQueue; AssignSteward(question,principal) -> Assignment; AnswerQuestion(question,digest,answerKind,payload,operationId) -> ScopedReceipt | RuleDraft | Stale.

ontology.clarifications(question_id PK,world_id,subject,predicate,scope_digest,candidate_digest,basis_ref,impact,deadline,state,steward_ref); ontology.stewardships(stewardship_id PK,world_id,scope,principal_ref,authority_kind,valid_interval); eve.question_delivery(question_id,relationship_id PK,attention_state,last_presented_digest). Deduplicate by world/subject/predicate/scope/candidate version.

[algorithm SPEC-017](../../../docs/algorithms/spec-017.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
