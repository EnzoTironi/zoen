# SPEC-022 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-022](../specs/spec-022.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel**. Module: `packages/ontology/src/actions`. Milestone: **S4**.

## Normative operation signatures

```text
ProposeAction(action,input,basis) -> ActionCase; AnswerCase(caseId,caseDigest,answer,operationId) -> CaseProgress | Receipt | Stale; CancelCase(caseId,operationId) -> State; CommitCase(caseId,digest) -> DecisionReceipt.
```

## State and transaction contract

ontology.action_cases(case_id PK,world_id,revision,action_id,release_digest,basis_ref,intent_json,case_digest,consequences_digest,guards_json,expires_at,state); ontology.case_approvals(case_id,revision,principal_id PK,answer,case_digest,assurance,policy_basis,recorded_at); ontology.case_receipts(case_id,revision PK,receipt_id,commit_id). Normative states add cancelled and blocked to v2 representative type examples.

## Shared algorithm

```text
RESOLVE released action and current permission; read preconditions through the shared semantic executor.
PLAN bounded local writes, reservations and effect templates without executing external requests.
FREEZE arguments, recipient, amounts, consequences, expiry and complete read guards into one Case digest.
PRESENT server-authorized Case in trusted host/chat confirmation; guest approval=true is not consent.
COLLECT approvals for the exact revision/digest; recheck each approver's current authority and assurance.
AT final quorum recheck time, head, policy, predicate and observed-value guards; any relevant change => Stale.
COMMIT through AuthorityCommit once: writes, receipt, stable EffectIntents and outbox; no network in transaction.
CANCEL and denial remain explicit; never silently refresh intent after consent or equate local commitment to external success.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0129](../tickets/zn-0129.md) | Compile Action plans and exact consequence digests | [packages/ontology/src/actions/action-plan.ts](../../packages/ontology/src/actions/action-plan.ts) |
| [ZN-0130](../tickets/zn-0130.md) | Persist Case revisions and lifecycle transitions | [packages/ontology/src/actions/case-store.ts](../../packages/ontology/src/actions/case-store.ts) |
| [ZN-0131](../tickets/zn-0131.md) | Implement scoped and quorum approvals | [packages/ontology/src/actions/approvals.ts](../../packages/ontology/src/actions/approvals.ts) |
| [ZN-0132](../tickets/zn-0132.md) | Commit guarded local decisions and effects atomically | [packages/ontology/src/actions/case-commit.ts](../../packages/ontology/src/actions/case-commit.ts) |
| [ZN-0133](../tickets/zn-0133.md) | Expose safe approvals through chat, UI and API | [tests/journey/spec-022/approval-surfaces.test.ts](../../tests/journey/spec-022/approval-surfaces.test.ts) |
| [ZN-0134](../tickets/zn-0134.md) | Prove stale consent and concurrent approvals | [tests/chaos/spec-022/action-chaos.test.ts](../../tests/chaos/spec-022/action-chaos.test.ts) |

## Required proof boundaries

Plan reads, preconditions, local writes, reservations and effect templates using the bounded IR. Freeze intent, recipient, amount, consequences and dependencies into Case digest. Every answer and final commit rechecks current authority/assurance. Quorum members approve the same revision/digest; changed input invalidates affected approvals. Final commit uses the shared atomic authority primitive.

V4 refinement: Mini-app form submissions invoke the same ActionCase/approval/commit implementation as chat and SDK. Consequential confirmation is rendered by the trusted host from a server-authorized Case, never trusted from app HTML or postMessage approval=true.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
