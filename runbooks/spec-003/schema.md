# File plan — `runbooks/spec-003/schema.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-003/schema.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-003](../../docs/specs/spec-003.md).
Tickets: [ZN-0019](../../docs/tickets/zn-0019.md).

## Responsibility and reuse

## ZN-0019 operational/repair procedure

Scope: Create owner-scoped SQL schema and migration discipline. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Migrations apply, fail midway and resume
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
INPUT: verified context, unchanged operation ID/intent, expected head, read guards and a typed local plan.
BEGIN SERIALIZABLE; acquire head share lock; check cell epoch, release/generation and current security state.
AUTHORIZE current principal/purpose before looking up or disclosing idempotent results.
LOOK UP scoped operation key; changed digest => Conflict; same intent => reauthorize stored result before return.
LOCK affected domains in sorted order; validate predicate/absence, identity, source watermark, time and policy guards.
IF relevant dependency changed: Stale; do not recompute an approved intent or partially write a receipt.
COMMIT local writes, domain counters, operation result, receipt and stable outbox identities together; no model/provider I/O inside transaction.
RETRY only admitted serialization/deadlock failures, at most three attempts, with same intent; ambiguous commit acknowledgement => Unknown and reconcile.
CLAIM outbox in bounded fenced leases; consumer records deduplication before acknowledgement; reject obsolete workers.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Both paths produce the expected schema without duplicate history; runtime roles cannot execute DDL or progress-write authority rows
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-003
AuthorityCommit(context, expectedHead, guards, operationKey, typedPlan) -> Receipt | Stale | Conflict; ProgressCommit(leaseToken,progress) -> Progress | LostLease; ClaimOutbox(owner,limit) -> FencedBatch.

ontology.domains(world_id,domain_id PK,version bigint>=0); ontology.operations(world_id,principal_id,semantic_op,operation_id PK,intent_digest,result_ref,commit_id); ontology.commits(commit_id PK,world_id,head_digest,touched_domains jsonb,recorded_at); ontology.receipts(receipt_id PK,world_id,commit_id,kind,payload_digest,payload_json); jobs.outbox(outbox_id PK,owner,world_id,commit_id,event_ordinal,payload_ref,status,lease_owner,fence,lease_until,UNIQUE(owner,commit_id,event_ordinal)). All world references include realm and ownership checks.

[algorithm SPEC-003](../../docs/algorithms/spec-003.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
