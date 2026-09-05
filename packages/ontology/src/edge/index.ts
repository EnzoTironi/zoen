// @zoen-plan packages/ontology/src/edge/index.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/edge/index.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/edge/index.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-044](../../../../docs/specs/spec-044.md).
// Tickets: [ZN-0255](../../../../docs/tickets/zn-0255.md), [ZN-0256](../../../../docs/tickets/zn-0256.md), [ZN-0257](../../../../docs/tickets/zn-0257.md), [ZN-0258](../../../../docs/tickets/zn-0258.md), [ZN-0259](../../../../docs/tickets/zn-0259.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-044
// IssueOfflineLease(scope,resourcePartition,expiry) -> ChildLease; RecordOfflineOperation(lease,intent) -> LocalReceipt | Denied; ReconcileChild(receipts) -> Admitted|Conflict|Expired; AdmitSelfHostedProfile(evidence) -> Profile; ProposeFleetUpdate(release) -> LocalChangeSet.
//
// ontology.child_leases(lease_id PK,parent_world,child_scope,epoch,resource_partition,allowed_ops,expires_at,clock_uncertainty,max_offline,state); ontology.offline_receipts(receipt_id PK,child_scope,lease_ref,sequence,intent_digest,observed_basis,reconciled_state); control.fleet_profiles(profile_id PK,version,equivalence_evidence,policy_digest,state).
//
// [algorithm SPEC-044](../../../../docs/algorithms/spec-044.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
