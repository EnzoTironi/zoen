# SPEC-017 — Clarification prioritization and scoped stewardship

**Milestone:** S2 · **Owner:** Knowledge and Experience · **Root:** `packages/ontology/src/stewardship`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Ask the right authorized person about consequential uncertainty, not everybody about every mismatch. A deterministic rubric ranks questions; no fabricated probability of truth. Teaching a reusable rule requires its own governed change.

## Owned state and storage contract
ontology.clarifications(question_id PK,world_id,subject,predicate,scope_digest,candidate_digest,basis_ref,impact,deadline,state,steward_ref); ontology.stewardships(stewardship_id PK,world_id,scope,principal_ref,authority_kind,valid_interval); eve.question_delivery(question_id,relationship_id PK,attention_state,last_presented_digest). Deduplicate by world/subject/predicate/scope/candidate version.

## Operations

```text
RankClarifications(scope,budget) -> QuestionQueue; AssignSteward(question,principal) -> Assignment; AnswerQuestion(question,digest,answerKind,payload,operationId) -> ScopedReceipt | RuleDraft | Stale.
```

## Execution protocol
Rank by consequence severity, deadline, reducibility and interruption/privacy cost using declared ordinal weights. Route only to authorized stewards with required evidence visibility. User reply kinds are assertion, identity resolution, instance decision, reusable-rule proposal and preference. Unknown/dismissal never votes. Changes to candidate set invalidate queued question versions.

## Pseudocode and file ownership

[algorithm SPEC-017](../algorithms/spec-017.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0101](../tickets/zn-0101.md) | Rank and deduplicate clarification candidates | component | [ZN-0041](../tickets/zn-0041.md), [ZN-0062](../tickets/zn-0062.md), [ZN-0088](../tickets/zn-0088.md) |
| [ZN-0102](../tickets/zn-0102.md) | Route questions using scoped stewardship | component | [ZN-0101](../tickets/zn-0101.md) |
| [ZN-0103](../tickets/zn-0103.md) | Keep five reply meanings distinct | component | [ZN-0102](../tickets/zn-0102.md) |
| [ZN-0104](../tickets/zn-0104.md) | Support stale questions, unknown answers and reversals | component | [ZN-0103](../tickets/zn-0103.md) |
| [ZN-0105](../tickets/zn-0105.md) | Expose stewardship workbench and quality feedback | journey | [ZN-0104](../tickets/zn-0104.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `truth-reconciliation-and-learning.md`, `runtime-variation-and-releases.md`. Read a named historical reference only when needed; it cannot override current contracts.
