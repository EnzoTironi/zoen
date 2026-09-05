// @zoen-plan packages/adapters/src/channels/whatsapp/types.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/adapters/src/channels/whatsapp/types.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/adapters/src/channels/whatsapp/types.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-011](../../../../../docs/specs/spec-011.md).
// Tickets: [ZN-0064](../../../../../docs/tickets/zn-0064.md), [ZN-0065](../../../../../docs/tickets/zn-0065.md), [ZN-0066](../../../../../docs/tickets/zn-0066.md), [ZN-0067](../../../../../docs/tickets/zn-0067.md), [ZN-0068](../../../../../docs/tickets/zn-0068.md).
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
// ### SPEC-011
// AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.
//
// channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.
//
// [algorithm SPEC-011](../../../../../docs/algorithms/spec-011.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
