# SPEC-017 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-017](../specs/spec-017.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Knowledge and Experience**. Module: `packages/ontology/src/stewardship`. Milestone: **S2**.

## Normative operation signatures

```text
RankClarifications(scope,budget) -> QuestionQueue; AssignSteward(question,principal) -> Assignment; AnswerQuestion(question,digest,answerKind,payload,operationId) -> ScopedReceipt | RuleDraft | Stale.
```

## State and transaction contract

ontology.clarifications(question_id PK,world_id,subject,predicate,scope_digest,candidate_digest,basis_ref,impact,deadline,state,steward_ref); ontology.stewardships(stewardship_id PK,world_id,scope,principal_ref,authority_kind,valid_interval); eve.question_delivery(question_id,relationship_id PK,attention_state,last_presented_digest). Deduplicate by world/subject/predicate/scope/candidate version.

## Shared algorithm

```text
IDENTIFY unresolved decisions at an authorized basis; compute consequence, deadline and reducibility from declared weights.
DEDUPLICATE question by World/subject/predicate/scope/candidate version; suppress stale or inaccessible candidates.
ROUTE only to an authorized steward who may see the evidence needed for the question.
PIN question digest, candidates and intended answer kind before presentation.
RECHECK authority, candidate basis and question freshness when response arrives.
DISTINGUISH assertion, identity choice, local decision, reusable-rule proposal and preference; dismissal/unknown is not a vote.
APPLY local correction via ordinary operation; reusable changes enter evaluation/publication separately.
TRACK unanswered/stopped states and interruption costs without promoting uncertainty to fabricated truth.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0101](../tickets/zn-0101.md) | Rank and deduplicate clarification candidates | [packages/ontology/src/stewardship/question-priority.ts](../../packages/ontology/src/stewardship/question-priority.ts) |
| [ZN-0102](../tickets/zn-0102.md) | Route questions using scoped stewardship | [packages/ontology/src/stewardship/steward-routing.ts](../../packages/ontology/src/stewardship/steward-routing.ts) |
| [ZN-0103](../tickets/zn-0103.md) | Keep five reply meanings distinct | [packages/ontology/src/stewardship/reply-kinds.ts](../../packages/ontology/src/stewardship/reply-kinds.ts) |
| [ZN-0104](../tickets/zn-0104.md) | Support stale questions, unknown answers and reversals | [packages/ontology/src/stewardship/question-lifecycle.ts](../../packages/ontology/src/stewardship/question-lifecycle.ts) |
| [ZN-0105](../tickets/zn-0105.md) | Expose stewardship workbench and quality feedback | [tests/journey/spec-017/steward-workbench.test.ts](../../tests/journey/spec-017/steward-workbench.test.ts) |

## Required proof boundaries

Rank by consequence severity, deadline, reducibility and interruption/privacy cost using declared ordinal weights. Route only to authorized stewards with required evidence visibility. User reply kinds are assertion, identity resolution, instance decision, reusable-rule proposal and preference. Unknown/dismissal never votes. Changes to candidate set invalidate queued question versions.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
