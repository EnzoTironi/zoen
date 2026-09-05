# SPEC-014 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-014](../specs/spec-014.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel**. Module: `packages/ontology/src/releases`. Milestone: **S2**.

## Normative operation signatures

```text
ProposeDefinitionChange(base,patch,operationId) -> Change; EvaluateChange(change) -> ReleaseProof; PrepareActivation(change,world) -> PreparedActivation; ApproveChange(change,digest) -> Approval; ActivateRelease(proof,preparation,approval,operationId) -> ActivationReceipt | PreparationStale.
```

## State and transaction contract

ontology.changes(change_id PK,world_id,base_release,candidate_release,risk,state,author,version); ontology.release_proofs(proof_id PK,release_digest,kernel_image,evaluation_world,cut_digest,report_ref,missing_attestations); ontology.preparations(preparation_id PK,world_id,expected_head,target_release,target_generation,through_cut,open_work_disposition,state); ontology.release_approvals(change_id,principal_id,case_digest PK,policy_basis); ontology.activations(receipt_id PK,world_id,old_head,new_head,proof_ref,preparation_ref). Evaluation namespaces and credentials are separate.

## Shared algorithm

```text
ACCEPT edits against stable symbols and expected base; classify instance, definition, artifact or kernel lane.
AUTHORIZE proposed change under CURRENT active policy; proposed policy cannot approve itself.
COMPILE candidate and compute semantic/permission/consequence diff plus affected dependency closure.
EVALUATE in an isolated realm with authorized test inputs, separate leases and sandbox destinations; absent real proof blocks its scope.
PREPARE non-authoritative projections/migration from committed cuts; classify Cases, Watches, Mandates and sessions for compatibility.
CATCH UP complete committed transitions; expected head or cut change => PreparationStale/rebase, not implicit consent refresh.
RECHECK approver/delegation/assurance, exact proof digests and recall/deny before atomic control-head compare-and-swap.
ACTIVATE release/generation and receipt together; no mixed active dual-write generation.
ROLLBACK as a new proved forward transition; do not revive revoked grants, erased data or replay settled effects.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0082](../tickets/zn-0082.md) | Implement change lanes and current-policy classification | [packages/ontology/src/releases/change-lanes.ts](../../packages/ontology/src/releases/change-lanes.ts) |
| [ZN-0083](../tickets/zn-0083.md) | Provision an isolated EvaluationWorld | [packages/ontology/src/releases/evaluation-world.ts](../../packages/ontology/src/releases/evaluation-world.ts) |
| [ZN-0084](../tickets/zn-0084.md) | Bind release proof to exact image, cut and exercised checks | [packages/ontology/src/releases/proof.ts](../../packages/ontology/src/releases/proof.ts) |
| [ZN-0085](../tickets/zn-0085.md) | Prepare data generations and open-work dispositions | [packages/ontology/src/releases/prepare.ts](../../packages/ontology/src/releases/prepare.ts) |
| [ZN-0086](../tickets/zn-0086.md) | Activate with an exclusive head transition | [packages/ontology/src/releases/activate.ts](../../packages/ontology/src/releases/activate.ts) |
| [ZN-0087](../tickets/zn-0087.md) | Implement concurrent edit rebase and forward repair | [packages/ontology/src/releases/rebase.ts](../../packages/ontology/src/releases/rebase.ts) |
| [ZN-0088](../tickets/zn-0088.md) | Prove runtime change without redeploy | [tests/journey/spec-014/runtime-change-journey.test.ts](../../tests/journey/spec-014/runtime-change-journey.test.ts) |

## Required proof boundaries

Each step binds immutable digests. Evaluation uses separate realm IDs, storage, source/effect leases and sink channels. Preparation builds a non-authoritative generation and catches up from committed envelopes only. Exclusive head lock rechecks current head, cuts, approvals and emergency denies. If convergence fails, use a bounded visible write fence. Rollback is a new prepared forward transition, never blind head reversal.

V4 refinement: MiniAppDefinition and AppPublicationBinding participate in this same release process. Runtime preparation and evaluation do not activate a public app. Publication, sharing and execution authority are distinct. Old-policy approval, prepared basis, manifest/artefact closure and emergency recall are rechecked at activation.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
