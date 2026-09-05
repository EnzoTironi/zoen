# File plan — `runbooks/spec-017/steward-workbench.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-017/steward-workbench.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-017](../../docs/specs/spec-017.md).
Tickets: [ZN-0105](../../docs/tickets/zn-0105.md).

## Responsibility and reuse

## ZN-0105 operational/repair procedure

Scope: Expose stewardship workbench and quality feedback. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
They select a bulk operation
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
IDENTIFY unresolved decisions at an authorized basis; compute consequence, deadline and reducibility from declared weights.
DEDUPLICATE question by World/subject/predicate/scope/candidate version; suppress stale or inaccessible candidates.
ROUTE only to an authorized steward who may see the evidence needed for the question.
PIN question digest, candidates and intended answer kind before presentation.
RECHECK authority, candidate basis and question freshness when response arrives.
DISTINGUISH assertion, identity choice, local decision, reusable-rule proposal and preference; dismissal/unknown is not a vote.
APPLY local correction via ordinary operation; reusable changes enter evaluation/publication separately.
TRACK unanswered/stopped states and interruption costs without promoting uncertainty to fabricated truth.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Only permitted routing occurs; each consequential resolution retains its own case/basis and the quality report preserves omitted scopes
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-017
RankClarifications(scope,budget) -> QuestionQueue; AssignSteward(question,principal) -> Assignment; AnswerQuestion(question,digest,answerKind,payload,operationId) -> ScopedReceipt | RuleDraft | Stale.

ontology.clarifications(question_id PK,world_id,subject,predicate,scope_digest,candidate_digest,basis_ref,impact,deadline,state,steward_ref); ontology.stewardships(stewardship_id PK,world_id,scope,principal_ref,authority_kind,valid_interval); eve.question_delivery(question_id,relationship_id PK,attention_state,last_presented_digest). Deduplicate by world/subject/predicate/scope/candidate version.

[algorithm SPEC-017](../../docs/algorithms/spec-017.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
