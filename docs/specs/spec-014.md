# SPEC-014 — Runtime change governance, evaluation, preparation and activation

**Milestone:** S2 · **Owner:** Kernel · **Root:** `packages/ontology/src/releases`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Four lanes: instance mutation, released declarative meaning, isolated executable artifact and privileged kernel change. The current policy governs a change; a candidate policy cannot approve itself. Activation is proof plus exact prepared data plus current approval.

## Owned state and storage contract
ontology.changes(change_id PK,world_id,base_release,candidate_release,risk,state,author,version); ontology.release_proofs(proof_id PK,release_digest,kernel_image,evaluation_world,cut_digest,report_ref,missing_attestations); ontology.preparations(preparation_id PK,world_id,expected_head,target_release,target_generation,through_cut,open_work_disposition,state); ontology.release_approvals(change_id,principal_id,case_digest PK,policy_basis); ontology.activations(receipt_id PK,world_id,old_head,new_head,proof_ref,preparation_ref). Evaluation namespaces and credentials are separate.

## Operations

```text
ProposeDefinitionChange(base,patch,operationId) -> Change; EvaluateChange(change) -> ReleaseProof; PrepareActivation(change,world) -> PreparedActivation; ApproveChange(change,digest) -> Approval; ActivateRelease(proof,preparation,approval,operationId) -> ActivationReceipt | PreparationStale.
```

## Execution protocol
Each step binds immutable digests. Evaluation uses separate realm IDs, storage, source/effect leases and sink channels. Preparation builds a non-authoritative generation and catches up from committed envelopes only. Exclusive head lock rechecks current head, cuts, approvals and emergency denies. If convergence fails, use a bounded visible write fence. Rollback is a new prepared forward transition, never blind head reversal.

V4 refinement: MiniAppDefinition and AppPublicationBinding participate in this same release process. Runtime preparation and evaluation do not activate a public app. Publication, sharing and execution authority are distinct. Old-policy approval, prepared basis, manifest/artefact closure and emergency recall are rechecked at activation.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-014](../algorithms/spec-014.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0082](../tickets/zn-0082.md) | Implement change lanes and current-policy classification | component | [ZN-0051](../tickets/zn-0051.md), [ZN-0081](../tickets/zn-0081.md) |
| [ZN-0083](../tickets/zn-0083.md) | Provision an isolated EvaluationWorld | component | [ZN-0082](../tickets/zn-0082.md) |
| [ZN-0084](../tickets/zn-0084.md) | Bind release proof to exact image, cut and exercised checks | component | [ZN-0083](../tickets/zn-0083.md) |
| [ZN-0085](../tickets/zn-0085.md) | Prepare data generations and open-work dispositions | component | [ZN-0084](../tickets/zn-0084.md) |
| [ZN-0086](../tickets/zn-0086.md) | Activate with an exclusive head transition | component | [ZN-0085](../tickets/zn-0085.md) |
| [ZN-0087](../tickets/zn-0087.md) | Implement concurrent edit rebase and forward repair | component | [ZN-0086](../tickets/zn-0086.md) |
| [ZN-0088](../tickets/zn-0088.md) | Prove runtime change without redeploy | journey | [ZN-0087](../tickets/zn-0087.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `runtime-variation-and-releases.md`, `release-engine-and-compiler.md`. Read a named historical reference only when needed; it cannot override current contracts.
