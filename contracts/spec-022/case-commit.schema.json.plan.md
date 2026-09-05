# File plan — `contracts/spec-022/case-commit.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-022/case-commit.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-022](../../docs/specs/spec-022.md).
Tickets: [ZN-0132](../../docs/tickets/zn-0132.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-022
ProposeAction(action,input,basis) -> ActionCase; AnswerCase(caseId,caseDigest,answer,operationId) -> CaseProgress | Receipt | Stale; CancelCase(caseId,operationId) -> State; CommitCase(caseId,digest) -> DecisionReceipt.

ontology.action_cases(case_id PK,world_id,revision,action_id,release_digest,basis_ref,intent_json,case_digest,consequences_digest,guards_json,expires_at,state); ontology.case_approvals(case_id,revision,principal_id PK,answer,case_digest,assurance,policy_basis,recorded_at); ontology.case_receipts(case_id,revision PK,receipt_id,commit_id). Normative states add cancelled and blocked to v2 representative type examples.

[algorithm SPEC-022](../../docs/algorithms/spec-022.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
