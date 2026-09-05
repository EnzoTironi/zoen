# File plan — `runbooks/spec-011/send-policy.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-011/send-policy.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-011](../../docs/specs/spec-011.md).
Tickets: [ZN-0066](../../docs/tickets/zn-0066.md).

## Responsibility and reuse

## ZN-0066 operational/repair procedure

Scope: Enforce message window, template and consent policy. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Eve requests delivery
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY exact admitted provider signature/replay contract on raw bytes before parsing; do not invent headers.
CHECK account namespace, payload limits and event identity; persist ingress and owned outbox before ACK.
DEDUPLICATE provider replay by stable event identity and dispatch one Eve turn after durable admission.
BIND channel to principal only via verified secure challenge and explicit consent; sender number is not a World grant.
CREATE authority-free continuation through SPEC-051; preview GET/HEAD is generic and consumes nothing.
BEFORE sending recheck audience, current disclosure, consent, provider template/window rules and enabled qualification.
PERSIST delivery intent then call the real provider outside authority transaction; observe actual accepted/delivered/unknown evidence.
ON lost acknowledgement reconcile known provider identity; never synthesize delivered status or blindly duplicate a consequential send.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
No prohibited message is sent; the result is deferred/denied with a privacy-safe reason
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-011
AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.

channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.

[algorithm SPEC-011](../../docs/algorithms/spec-011.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
