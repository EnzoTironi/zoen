// @zoen-plan packages/ontology/src/effects/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/effects/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/effects/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-023](../../../../docs/specs/spec-023.md).
// Tickets: [ZN-0135](../../../../docs/tickets/zn-0135.md), [ZN-0136](../../../../docs/tickets/zn-0136.md), [ZN-0137](../../../../docs/tickets/zn-0137.md), [ZN-0138](../../../../docs/tickets/zn-0138.md), [ZN-0139](../../../../docs/tickets/zn-0139.md).
//
// ## Responsibility and reuse
//
// ```text
// CONTRACT SURFACE PLAN.
// DEFINE only the owning module's input/output/error/state and dependency-port types.
// REUSE branded kernel values, verified context, common semantic envelope and typed results.
// DO NOT export repositories or broad credentials to clients; authority context is server verified.
// SEPARATE versioned semantic meaning from transport metadata and immutable artifacts from mutable runtime state.
// VERIFY consumers use the same contracts and exhaustive tagged outcomes; unsupported shapes fail closed.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-023
// AcquireEffectPermit(intent,worker,epoch) -> Permit | Denied; AttemptEffect(intent,permit) -> AttemptObservation; ReconcileEffect(effectId) -> ObservedState | Unknown; RecordSettlement(effectId,providerEvidence) -> SettlementReceipt.
//
// ontology.effect_intents(effect_id PK,world_id,receipt_id,ordinal,provider,operation,intent_digest,args_ref,deadline,UNIQUE(receipt_id,ordinal)); ontology.effect_attempts(attempt_id PK,effect_id,epoch,fence,permit_ref,state,sent_at,provider_key,observation_ref); ontology.settlements(settlement_id PK,effect_id,status,provider_state,evidence_refs,observed_at,supersedes); ontology.provider_contracts(contract_id PK,provider,api_version,idempotency_scope,horizon,reconciliation_modes,certificate_ref).
//
// [algorithm SPEC-023](../../../../docs/algorithms/spec-023.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
