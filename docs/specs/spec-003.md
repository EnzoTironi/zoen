# SPEC-003 — Atomic authority, domain guards and durable handoff

**Milestone:** S0 · **Owner:** Kernel · **Root:** `packages/ontology/src/authority`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
One authoritative cell per World epoch, independent ordering domains inside a World. PostgreSQL is the local authority; no provider call runs in an authority transaction. Conservative domain/predicate fences are the initial correctness baseline.

## Owned state and storage contract
ontology.domains(world_id,domain_id PK,version bigint>=0); ontology.operations(world_id,principal_id,semantic_op,operation_id PK,intent_digest,result_ref,commit_id); ontology.commits(commit_id PK,world_id,head_digest,touched_domains jsonb,recorded_at); ontology.receipts(receipt_id PK,world_id,commit_id,kind,payload_digest,payload_json); jobs.outbox(outbox_id PK,owner,world_id,commit_id,event_ordinal,payload_ref,status,lease_owner,fence,lease_until,UNIQUE(owner,commit_id,event_ordinal)). All world references include realm and ownership checks.

## Operations

```text
AuthorityCommit(context, expectedHead, guards, operationKey, typedPlan) -> Receipt | Stale | Conflict; ProgressCommit(leaseToken,progress) -> Progress | LostLease; ClaimOutbox(owner,limit) -> FencedBatch.
```

## Execution protocol
Begin SERIALIZABLE; acquire WorldHead FOR SHARE, check epoch/release/generation/security; lock domains sorted by ID; verify current authority; validate operation digest; check domain/predicate/source/identity/clock guards; write semantic changes, counters, receipt and outbox atomically. Retry only serialization/deadlock failures up to 3 attempts with the same intent and no consent rebasing. A replay is reauthorized before disclosing stored output.

The initial authority migration owns the Ontology tables listed by SPEC-002 as well as this spec. Genesis reuses AuthorityCommit; there is no separate privileged transaction engine. World creation uses an operation scope derived from the principal before the new World exists; its unique genesis operation row and all new World rows commit in one SERIALIZABLE transaction. Subsequent operations use World-scoped keys.
S0 guard/commit tests use minimal typed AuthorityCommit plans and synthetic saved read sets, not the complete S4 ActionCase engine. The exact same primitive is exercised again through real ActionCases at S4; do not build a parallel authority implementation merely to satisfy the early fixture.

## Pseudocode and file ownership

[algorithm SPEC-003](../algorithms/spec-003.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0019](../tickets/zn-0019.md) | Create owner-scoped SQL schema and migration discipline | component | [ZN-0012](../tickets/zn-0012.md), [ZN-0013](../tickets/zn-0013.md) |
| [ZN-0020](../tickets/zn-0020.md) | Implement serializable commits with sorted domain locks | component | [ZN-0019](../tickets/zn-0019.md) |
| [ZN-0021](../tickets/zn-0021.md) | Implement operation idempotency with fresh replay disclosure | component | [ZN-0020](../tickets/zn-0020.md) |
| [ZN-0022](../tickets/zn-0022.md) | Implement complete read guards including absent-row predicates | component | [ZN-0021](../tickets/zn-0021.md) |
| [ZN-0023](../tickets/zn-0023.md) | Implement fenced outbox leases and idempotent consumer handoff | component | [ZN-0022](../tickets/zn-0022.md) |
| [ZN-0024](../tickets/zn-0024.md) | Prove commit boundaries with real process termination | chaos | [ZN-0023](../tickets/zn-0023.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `authority-concurrency-and-cuts.md`, `database-access.md`, `actions-effects-and-settlement.md`. Read a named historical reference only when needed; it cannot override current contracts.
