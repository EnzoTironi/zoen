# File plan — `runbooks/spec-014/change-lanes.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-014/change-lanes.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-014](../../docs/specs/spec-014.md).
Tickets: [ZN-0082](../../docs/tickets/zn-0082.md).

## Responsibility and reuse

## ZN-0082 operational/repair procedure

Scope: Implement change lanes and current-policy classification. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The semantic diff classifies the candidate
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
ACCEPT edits against stable symbols and expected base; classify instance, definition, artifact or kernel lane.
AUTHORIZE proposed change under CURRENT active policy; proposed policy cannot approve itself.
COMPILE candidate and compute semantic/permission/consequence diff plus affected dependency closure.
EVALUATE in an isolated realm with authorized test inputs, separate leases and sandbox destinations; absent real proof blocks its scope.
PREPARE non-authoritative projections/migration from committed cuts; classify Cases, Watches, Mandates and sessions for compatibility.
CATCH UP complete committed transitions; expected head or cut change => PreparationStale/rebase, not implicit consent refresh.
RECHECK approver/delegation/assurance, exact proof digests and recall/deny before atomic control-head compare-and-swap.
ACTIVATE release/generation and receipt together; no mixed active dual-write generation.
ROLLBACK as a new proved forward transition; do not revive revoked grants, erased data or replay settled effects.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It enters the rights-change lane and cannot use the candidate policy to grant or approve itself
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-014
ProposeDefinitionChange(base,patch,operationId) -> Change; EvaluateChange(change) -> ReleaseProof; PrepareActivation(change,world) -> PreparedActivation; ApproveChange(change,digest) -> Approval; ActivateRelease(proof,preparation,approval,operationId) -> ActivationReceipt | PreparationStale.

ontology.changes(change_id PK,world_id,base_release,candidate_release,risk,state,author,version); ontology.release_proofs(proof_id PK,release_digest,kernel_image,evaluation_world,cut_digest,report_ref,missing_attestations); ontology.preparations(preparation_id PK,world_id,expected_head,target_release,target_generation,through_cut,open_work_disposition,state); ontology.release_approvals(change_id,principal_id,case_digest PK,policy_basis); ontology.activations(receipt_id PK,world_id,old_head,new_head,proof_ref,preparation_ref). Evaluation namespaces and credentials are separate.

[algorithm SPEC-014](../../docs/algorithms/spec-014.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
