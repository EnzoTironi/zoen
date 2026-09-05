# File plan — `admissions/spec-011/extension-lock.json`

**Status:** planned; no product acceptance implied.

Target: `admissions/spec-011/extension-lock.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-011](../../docs/specs/spec-011.md).
Tickets: [ZN-0064](../../docs/tickets/zn-0064.md).

## Responsibility and reuse

```text
EVIDENCE-REQUIRES-EXECUTION — deliberately no fabricated target artifact.
RUN the actual registry/package-manager/provider/infrastructure qualification for this ticket.
RECORD observed identities, exact versions/integrity, supported API/profile, commands and failed or blocked results.
REQUIRE independent approval and current expiry/scope where applicable.
ONLY produce a lock using the real package manager; only produce a certificate from actual evidence.
NEVER rename this plan into a passing report.
```

## Owning state / operation contracts

### SPEC-011
AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.

channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.

[algorithm SPEC-011](../../docs/algorithms/spec-011.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
