# File plan — `runbooks/spec-022/action-chaos.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-022/action-chaos.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-022](../../docs/specs/spec-022.md).
Tickets: [ZN-0134](../../docs/tickets/zn-0134.md).

## Responsibility and reuse

## ZN-0134 operational/repair procedure

Scope: Prove stale consent and concurrent approvals. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The full action journey runs
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
RESOLVE released action and current permission; read preconditions through the shared semantic executor.
PLAN bounded local writes, reservations and effect templates without executing external requests.
FREEZE arguments, recipient, amounts, consequences, expiry and complete read guards into one Case digest.
PRESENT server-authorized Case in trusted host/chat confirmation; guest approval=true is not consent.
COLLECT approvals for the exact revision/digest; recheck each approver's current authority and assurance.
AT final quorum recheck time, head, policy, predicate and observed-value guards; any relevant change => Stale.
COMMIT through AuthorityCommit once: writes, receipt, stable EffectIntents and outbox; no network in transaction.
CANCEL and denial remain explicit; never silently refresh intent after consent or equate local commitment to external success.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
The result is Stale with no local/external effect; unchanged authorized retries resolve one receipt
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-022
ProposeAction(action,input,basis) -> ActionCase; AnswerCase(caseId,caseDigest,answer,operationId) -> CaseProgress | Receipt | Stale; CancelCase(caseId,operationId) -> State; CommitCase(caseId,digest) -> DecisionReceipt.

ontology.action_cases(case_id PK,world_id,revision,action_id,release_digest,basis_ref,intent_json,case_digest,consequences_digest,guards_json,expires_at,state); ontology.case_approvals(case_id,revision,principal_id PK,answer,case_digest,assurance,policy_basis,recorded_at); ontology.case_receipts(case_id,revision PK,receipt_id,commit_id). Normative states add cancelled and blocked to v2 representative type examples.

[algorithm SPEC-022](../../docs/algorithms/spec-022.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
