# SPEC-022 — Released Actions, approvals and accountable local decisions

**Milestone:** S4 · **Owner:** Kernel · **Root:** `packages/ontology/src/actions`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Every consequential operation uses a released ActionDefinition and an immutable consequence-sensitive Case revision. Approval is not commitment; commitment is not external success. Existing image-pinned bootstrap/correction operations are not a generic bypass for arbitrary new actions.

## Owned state and storage contract
ontology.action_cases(case_id PK,world_id,revision,action_id,release_digest,basis_ref,intent_json,case_digest,consequences_digest,guards_json,expires_at,state); ontology.case_approvals(case_id,revision,principal_id PK,answer,case_digest,assurance,policy_basis,recorded_at); ontology.case_receipts(case_id,revision PK,receipt_id,commit_id). Normative states add cancelled and blocked to v2 representative type examples.

## Operations

```text
ProposeAction(action,input,basis) -> ActionCase; AnswerCase(caseId,caseDigest,answer,operationId) -> CaseProgress | Receipt | Stale; CancelCase(caseId,operationId) -> State; CommitCase(caseId,digest) -> DecisionReceipt.
```

## Execution protocol
Plan reads, preconditions, local writes, reservations and effect templates using the bounded IR. Freeze intent, recipient, amount, consequences and dependencies into Case digest. Every answer and final commit rechecks current authority/assurance. Quorum members approve the same revision/digest; changed input invalidates affected approvals. Final commit uses the shared atomic authority primitive.

V4 refinement: Mini-app form submissions invoke the same ActionCase/approval/commit implementation as chat and SDK. Consequential confirmation is rendered by the trusted host from a server-authorized Case, never trusted from app HTML or postMessage approval=true.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-022](../algorithms/spec-022.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0129](../tickets/zn-0129.md) | Compile Action plans and exact consequence digests | component | [ZN-0088](../tickets/zn-0088.md), [ZN-0111](../tickets/zn-0111.md), [ZN-0123](../tickets/zn-0123.md) |
| [ZN-0130](../tickets/zn-0130.md) | Persist Case revisions and lifecycle transitions | component | [ZN-0129](../tickets/zn-0129.md) |
| [ZN-0131](../tickets/zn-0131.md) | Implement scoped and quorum approvals | component | [ZN-0130](../tickets/zn-0130.md) |
| [ZN-0132](../tickets/zn-0132.md) | Commit guarded local decisions and effects atomically | component | [ZN-0131](../tickets/zn-0131.md) |
| [ZN-0133](../tickets/zn-0133.md) | Expose safe approvals through chat, UI and API | journey | [ZN-0132](../tickets/zn-0132.md) |
| [ZN-0134](../tickets/zn-0134.md) | Prove stale consent and concurrent approvals | chaos | [ZN-0133](../tickets/zn-0133.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `actions-effects-and-settlement.md`, `authority-concurrency-and-cuts.md`. Read a named historical reference only when needed; it cannot override current contracts.
