# File plan — `runbooks/spec-019/legal-hold.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-019/legal-hold.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-019](../../docs/specs/spec-019.md).
Tickets: [ZN-0115](../../docs/tickets/zn-0115.md).

## Responsibility and reuse

## ZN-0115 operational/repair procedure

Scope: Route legal-hold conflicts to explicit review. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The agent attempts automatic deletion or silent retention
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
AUTHORIZE and scope erasure request; check current retention, license, legal holds and required approvers.
ENUMERATE controlled originals and derivatives by lineage: blobs, claims, extracts, indexes, embeddings, summaries, caches, dataset files and exports.
CREATE idempotent per-store tasks and independently durable deletion ledger entries with permitted metadata only.
EXECUTE actual deletion under narrow store authority; observe completion before marking task done.
REPORT unavailable third-party erasure or retained legal hold as unresolved/held, not successful destruction.
INVALIDATE affected Frames, queries, app sessions/caches and derivative artifacts without leaking deleted content.
ON restore apply CURRENT ledger beyond backup cut before opening reads or dispatch.
PRESERVE only authorized non-content explanation that historical content is unavailable; no resurrection from old releases.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Neither hidden choice is allowed; the case records the conflict and awaits authorized review
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-019
RequestErasure(scope) -> ReviewedCase; PlanErasure(case,basis) -> ArtifactClosure; ExecuteErasure(task,permit) -> DeletionReceipt; CheckRestoreSuppression(restoredCut,currentLedger) -> SuppressionPlan | Blocked.

ontology.retention_policies(policy_id PK,scope,purpose,expiry_rule,hold_rules,version); ontology.erasure_cases(case_id PK,scope,requested_by,state,decision_ref); ontology.erasure_tasks(task_id PK,case_id,artifact_ref,store,kind,state,receipt_ref); audit.deletion_ledger(sequence PK,scope_digest,artifact_ref,decision_ref,effective_at); ontology.holds(hold_id PK,scope,authority_evidence,expires_at,state). Deletion ledger durability is separate from a restored application backup.

[algorithm SPEC-019](../../docs/algorithms/spec-019.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
