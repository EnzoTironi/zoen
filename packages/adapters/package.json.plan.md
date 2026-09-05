# File plan — `packages/adapters/package.json`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `packages/adapters/package.json`. Representation: **existing-with-sidecar**. Allocation: **conditional-support**.

Specs: [SPEC-000](../../docs/specs/spec-000.md), [SPEC-011](../../docs/specs/spec-011.md), [SPEC-054](../../docs/specs/spec-054.md).
Tickets: [ZN-0003](../../docs/tickets/zn-0003.md), [ZN-0064](../../docs/tickets/zn-0064.md), [ZN-0314](../../docs/tickets/zn-0314.md), [ZN-0316](../../docs/tickets/zn-0316.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
CONDITIONAL SUPPORT SEGMENT.
FIRST prove this file is needed by an owning ticket; do not implement parallel abstractions merely to fill paths.
READ the current implementation and shared module algorithm; select only the missing support responsibility.
KEEP dependency direction and single authority ownership; no provider success stub or ambient credential.
WIRE into the owning ticket's declared entry and prove its exact tests.
```

## Owning state / operation contracts

### SPEC-000
AdmitExecutionProfile(profile, candidateVersions, integrityDigests, compatibilityReport) -> AdmittedLock | Blocked; VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite.

No application tables. Track execution-lock.json, baseline-inventory.json and evidence-index.json as reviewed artifacts. Secret values never belong in these files.

[algorithm SPEC-000](../../docs/algorithms/spec-000.md)

### SPEC-011
AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.

channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.

[algorithm SPEC-011](../../docs/algorithms/spec-011.md)

### SPEC-054
Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.

jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.

[algorithm SPEC-054](../../docs/algorithms/spec-054.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
