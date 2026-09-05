# SPEC-003 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-003](../specs/spec-003.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel**. Module: `packages/ontology/src/authority`. Milestone: **S0**.

## Normative operation signatures

```text
AuthorityCommit(context, expectedHead, guards, operationKey, typedPlan) -> Receipt | Stale | Conflict; ProgressCommit(leaseToken,progress) -> Progress | LostLease; ClaimOutbox(owner,limit) -> FencedBatch.
```

## State and transaction contract

ontology.domains(world_id,domain_id PK,version bigint>=0); ontology.operations(world_id,principal_id,semantic_op,operation_id PK,intent_digest,result_ref,commit_id); ontology.commits(commit_id PK,world_id,head_digest,touched_domains jsonb,recorded_at); ontology.receipts(receipt_id PK,world_id,commit_id,kind,payload_digest,payload_json); jobs.outbox(outbox_id PK,owner,world_id,commit_id,event_ordinal,payload_ref,status,lease_owner,fence,lease_until,UNIQUE(owner,commit_id,event_ordinal)). All world references include realm and ownership checks.

## Shared algorithm

```text
INPUT: verified context, unchanged operation ID/intent, expected head, read guards and a typed local plan.
BEGIN SERIALIZABLE; acquire head share lock; check cell epoch, release/generation and current security state.
AUTHORIZE current principal/purpose before looking up or disclosing idempotent results.
LOOK UP scoped operation key; changed digest => Conflict; same intent => reauthorize stored result before return.
LOCK affected domains in sorted order; validate predicate/absence, identity, source watermark, time and policy guards.
IF relevant dependency changed: Stale; do not recompute an approved intent or partially write a receipt.
COMMIT local writes, domain counters, operation result, receipt and stable outbox identities together; no model/provider I/O inside transaction.
RETRY only admitted serialization/deadlock failures, at most three attempts, with same intent; ambiguous commit acknowledgement => Unknown and reconcile.
CLAIM outbox in bounded fenced leases; consumer records deduplication before acknowledgement; reject obsolete workers.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0019](../tickets/zn-0019.md) | Create owner-scoped SQL schema and migration discipline | [packages/ontology/src/authority/schema.ts](../../packages/ontology/src/authority/schema.ts) |
| [ZN-0020](../tickets/zn-0020.md) | Implement serializable commits with sorted domain locks | [packages/ontology/src/authority/transaction.ts](../../packages/ontology/src/authority/transaction.ts.plan.md) |
| [ZN-0021](../tickets/zn-0021.md) | Implement operation idempotency with fresh replay disclosure | [packages/ontology/src/authority/idempotency.ts](../../packages/ontology/src/authority/idempotency.ts) |
| [ZN-0022](../tickets/zn-0022.md) | Implement complete read guards including absent-row predicates | [packages/ontology/src/authority/guards.ts](../../packages/ontology/src/authority/guards.ts.plan.md) |
| [ZN-0023](../tickets/zn-0023.md) | Implement fenced outbox leases and idempotent consumer handoff | [packages/ontology/src/authority/outbox.ts](../../packages/ontology/src/authority/outbox.ts.plan.md) |
| [ZN-0024](../tickets/zn-0024.md) | Prove commit boundaries with real process termination | [tests/chaos/spec-003/commit-chaos.test.ts](../../tests/chaos/spec-003/commit-chaos.test.ts) |

## Required proof boundaries

Begin SERIALIZABLE; acquire WorldHead FOR SHARE, check epoch/release/generation/security; lock domains sorted by ID; verify current authority; validate operation digest; check domain/predicate/source/identity/clock guards; write semantic changes, counters, receipt and outbox atomically. Retry only serialization/deadlock failures up to 3 attempts with the same intent and no consent rebasing. A replay is reauthorized before disclosing stored output.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
