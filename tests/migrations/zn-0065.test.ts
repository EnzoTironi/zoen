// @zoen-plan tests/migrations/zn-0065.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/migrations/zn-0065.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/migrations/zn-0065.test.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-011](../../docs/specs/spec-011.md).
// Tickets: [ZN-0065](../../docs/tickets/zn-0065.md).
//
// ## Responsibility and reuse
//
// ```text
// CONDITIONAL SUPPORT SEGMENT.
// FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
// READ the current implementation and shared module algorithm; select only the missing support responsibility.
// KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
// WIRE into the owning ticket's declared entry and prove its exact tests.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-011
// AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.
//
// channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.
//
// [algorithm SPEC-011](../../docs/algorithms/spec-011.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
