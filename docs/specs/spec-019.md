# SPEC-019 — Retention, erasure, legal holds and restore suppression

**Milestone:** S3 · **Owner:** Privacy and Operations · **Root:** `packages/ontology/src/lifecycle`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Immutability is bounded by retention and lawful deletion obligations. Retained receipts can prove an operation while payloads become unavailable. A legal hold conflict is reviewed, not solved by an autonomous model. Restores cannot revive forbidden content.

## Owned state and storage contract
ontology.retention_policies(policy_id PK,scope,purpose,expiry_rule,hold_rules,version); ontology.erasure_cases(case_id PK,scope,requested_by,state,decision_ref); ontology.erasure_tasks(task_id PK,case_id,artifact_ref,store,kind,state,receipt_ref); audit.deletion_ledger(sequence PK,scope_digest,artifact_ref,decision_ref,effective_at); ontology.holds(hold_id PK,scope,authority_evidence,expires_at,state). Deletion ledger durability is separate from a restored application backup.

## Operations

```text
RequestErasure(scope) -> ReviewedCase; PlanErasure(case,basis) -> ArtifactClosure; ExecuteErasure(task,permit) -> DeletionReceipt; CheckRestoreSuppression(restoredCut,currentLedger) -> SuppressionPlan | Blocked.
```

## Execution protocol
Enumerate original and derived artifacts: raw bytes, claims payloads, extracts, indexes, embeddings, caches, summaries, dataset files, model-training manifests and exports under control. Record unsupported third-party erasure as an unresolved obligation, not success. Keep sufficient permitted non-content metadata to explain unavailable history. Apply the current deletion ledger before any restored environment opens reads or effects.

## Pseudocode and file ownership

[algorithm SPEC-019](../algorithms/spec-019.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0112](../tickets/zn-0112.md) | Classify retention and license expiry at admission | component | [ZN-0051](../tickets/zn-0051.md), [ZN-0111](../tickets/zn-0111.md) |
| [ZN-0113](../tickets/zn-0113.md) | Build erasure closure and explicit obligation tracking | component | [ZN-0112](../tickets/zn-0112.md) |
| [ZN-0114](../tickets/zn-0114.md) | Execute erasure with non-content receipts | component | [ZN-0113](../tickets/zn-0113.md) |
| [ZN-0115](../tickets/zn-0115.md) | Route legal-hold conflicts to explicit review | component | [ZN-0114](../tickets/zn-0114.md) |
| [ZN-0116](../tickets/zn-0116.md) | Suppress erased data after restore | chaos | [ZN-0115](../tickets/zn-0115.md) |
| [ZN-0117](../tickets/zn-0117.md) | Prove correction, expiry and erasure remain distinguishable | journey | [ZN-0116](../tickets/zn-0116.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `lifecycle-privacy-and-retention.md`, `security-and-operations.md`. Read a named historical reference only when needed; it cannot override current contracts.
