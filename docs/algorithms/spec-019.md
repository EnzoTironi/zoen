# SPEC-019 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-019](../specs/spec-019.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Privacy and Operations**. Module: `packages/ontology/src/lifecycle`. Milestone: **S3**.

## Normative operation signatures

```text
RequestErasure(scope) -> ReviewedCase; PlanErasure(case,basis) -> ArtifactClosure; ExecuteErasure(task,permit) -> DeletionReceipt; CheckRestoreSuppression(restoredCut,currentLedger) -> SuppressionPlan | Blocked.
```

## State and transaction contract

ontology.retention_policies(policy_id PK,scope,purpose,expiry_rule,hold_rules,version); ontology.erasure_cases(case_id PK,scope,requested_by,state,decision_ref); ontology.erasure_tasks(task_id PK,case_id,artifact_ref,store,kind,state,receipt_ref); audit.deletion_ledger(sequence PK,scope_digest,artifact_ref,decision_ref,effective_at); ontology.holds(hold_id PK,scope,authority_evidence,expires_at,state). Deletion ledger durability is separate from a restored application backup.

## Shared algorithm

```text
AUTHORIZE and scope erasure request; check current retention, license, legal holds and required approvers.
ENUMERATE controlled originals and derivatives by lineage: blobs, claims, extracts, indexes, embeddings, summaries, caches, dataset files and exports.
CREATE idempotent per-store tasks and independently durable deletion ledger entries with permitted metadata only.
EXECUTE actual deletion under narrow store authority; observe completion before marking task done.
REPORT unavailable third-party erasure or retained legal hold as unresolved/held, not successful destruction.
INVALIDATE affected Frames, queries, app sessions/caches and derivative artifacts without leaking deleted content.
ON restore apply CURRENT ledger beyond backup cut before opening reads or dispatch.
PRESERVE only authorized non-content explanation that historical content is unavailable; no resurrection from old releases.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0112](../tickets/zn-0112.md) | Classify retention and license expiry at admission | [packages/ontology/src/lifecycle/retention-policy.ts](../../packages/ontology/src/lifecycle/retention-policy.ts) |
| [ZN-0113](../tickets/zn-0113.md) | Build erasure closure and explicit obligation tracking | [packages/ontology/src/lifecycle/erasure-plan.ts](../../packages/ontology/src/lifecycle/erasure-plan.ts) |
| [ZN-0114](../tickets/zn-0114.md) | Execute erasure with non-content receipts | [packages/ontology/src/lifecycle/erasure-execute.ts](../../packages/ontology/src/lifecycle/erasure-execute.ts) |
| [ZN-0115](../tickets/zn-0115.md) | Route legal-hold conflicts to explicit review | [packages/ontology/src/lifecycle/legal-hold.ts](../../packages/ontology/src/lifecycle/legal-hold.ts) |
| [ZN-0116](../tickets/zn-0116.md) | Suppress erased data after restore | [tests/chaos/spec-019/restore-suppression.test.ts](../../tests/chaos/spec-019/restore-suppression.test.ts) |
| [ZN-0117](../tickets/zn-0117.md) | Prove correction, expiry and erasure remain distinguishable | [tests/journey/spec-019/lifecycle-journey.test.ts](../../tests/journey/spec-019/lifecycle-journey.test.ts) |

## Required proof boundaries

Enumerate original and derived artifacts: raw bytes, claims payloads, extracts, indexes, embeddings, caches, summaries, dataset files, model-training manifests and exports under control. Record unsupported third-party erasure as an unresolved obligation, not success. Keep sufficient permitted non-content metadata to explain unavailable history. Apply the current deletion ledger before any restored environment opens reads or effects.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
